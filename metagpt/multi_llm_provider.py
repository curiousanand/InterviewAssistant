#!/usr/bin/env python3
"""
Multi-LLM Provider System for MetaGPT
Supports Claude Code, OpenAI, Anthropic API, and other providers
"""

import asyncio
import subprocess
import os
from typing import List, Dict, Optional, Union
from abc import ABC, abstractmethod
from concurrent.futures import ThreadPoolExecutor
import json

class BaseLLMProvider(ABC):
    """Abstract base class for LLM providers."""
    
    def __init__(self, name: str):
        self.name = name
        self.executor = ThreadPoolExecutor(max_workers=1)
    
    @abstractmethod
    async def acompletion_text(self, messages: List[Dict[str, str]], **kwargs) -> str:
        """Generate completion text asynchronously."""
        pass
    
    @abstractmethod
    def completion_text(self, messages: List[Dict[str, str]], **kwargs) -> str:
        """Generate completion text synchronously."""
        pass
    
    def _messages_to_prompt(self, messages: List[Dict[str, str]]) -> str:
        """Convert messages to single prompt."""
        if not messages:
            return ""
        
        prompt_parts = []
        for msg in messages:
            role = msg.get('role', 'user')
            content = msg.get('content', '')
            
            if role == 'system':
                prompt_parts.append(f"System: {content}")
            elif role == 'user':
                prompt_parts.append(f"User: {content}")
            elif role == 'assistant':
                prompt_parts.append(f"Assistant: {content}")
        
        return "\\n\\n".join(prompt_parts)
    
    async def aask(self, prompt: str, **kwargs) -> str:
        """Simple ask method for compatibility."""
        messages = [{"role": "user", "content": prompt}]
        return await self.acompletion_text(messages, **kwargs)
    
    def ask(self, prompt: str, **kwargs) -> str:
        """Synchronous ask method."""
        messages = [{"role": "user", "content": prompt}]
        return self.completion_text(messages, **kwargs)


class ClaudeCodeProvider(BaseLLMProvider):
    """Claude Code CLI provider (original)."""
    
    def __init__(self, project_path: Optional[str] = None, timeout: int = 300):
        super().__init__("ClaudeCode")
        self.project_path = project_path or os.getcwd()
        self.timeout = timeout
    
    async def acompletion_text(self, messages: List[Dict[str, str]], **kwargs) -> str:
        prompt = self._messages_to_prompt(messages)
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(self.executor, self._run_claude_command, prompt)
    
    def completion_text(self, messages: List[Dict[str, str]], **kwargs) -> str:
        prompt = self._messages_to_prompt(messages)
        return self._run_claude_command(prompt)
    
    def _run_claude_command(self, prompt: str) -> str:
        try:
            cmd = ['claude', '--print', prompt]
            result = subprocess.run(
                cmd, capture_output=True, text=True, 
                timeout=self.timeout, cwd=self.project_path
            )
            
            if result.returncode == 0:
                return result.stdout.strip()
            else:
                return f"Claude Code Error: {result.stderr}"
        except subprocess.TimeoutExpired:
            return f"Claude Code timeout after {self.timeout}s"
        except Exception as e:
            return f"Claude Code error: {str(e)}"


class OpenAIProvider(BaseLLMProvider):
    """OpenAI API provider (much faster)."""
    
    def __init__(self, api_key: Optional[str] = None, model: str = "gpt-4"):
        super().__init__("OpenAI")
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.model = model
        
        if not self.api_key:
            raise ValueError("OpenAI API key required. Set OPENAI_API_KEY env var or pass api_key parameter.")
        
        try:
            import openai
            self.client = openai.OpenAI(api_key=self.api_key)
        except ImportError:
            raise ImportError("Install openai package: pip install openai")
    
    async def acompletion_text(self, messages: List[Dict[str, str]], **kwargs) -> str:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(self.executor, self._make_completion, messages, kwargs)
    
    def completion_text(self, messages: List[Dict[str, str]], **kwargs) -> str:
        return self._make_completion(messages, kwargs)
    
    def _make_completion(self, messages: List[Dict[str, str]], kwargs: Dict) -> str:
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=kwargs.get('max_tokens', 4000),
                temperature=kwargs.get('temperature', 0.7)
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"OpenAI API Error: {str(e)}"


class AnthropicProvider(BaseLLMProvider):
    """Anthropic API provider (Claude via API)."""
    
    def __init__(self, api_key: Optional[str] = None, model: str = "claude-3-sonnet-20240229"):
        super().__init__("Anthropic")
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
        self.model = model
        
        if not self.api_key:
            raise ValueError("Anthropic API key required. Set ANTHROPIC_API_KEY env var or pass api_key parameter.")
        
        try:
            import anthropic
            self.client = anthropic.Anthropic(api_key=self.api_key)
        except ImportError:
            raise ImportError("Install anthropic package: pip install anthropic")
    
    async def acompletion_text(self, messages: List[Dict[str, str]], **kwargs) -> str:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(self.executor, self._make_completion, messages, kwargs)
    
    def completion_text(self, messages: List[Dict[str, str]], **kwargs) -> str:
        return self._make_completion(messages, kwargs)
    
    def _make_completion(self, messages: List[Dict[str, str]], kwargs: Dict) -> str:
        try:
            # Convert messages for Anthropic format
            system_msgs = [msg['content'] for msg in messages if msg['role'] == 'system']
            user_msgs = [msg for msg in messages if msg['role'] != 'system']
            
            system_prompt = "\\n".join(system_msgs) if system_msgs else ""
            
            response = self.client.messages.create(
                model=self.model,
                max_tokens=kwargs.get('max_tokens', 4000),
                system=system_prompt,
                messages=user_msgs
            )
            return response.content[0].text
        except Exception as e:
            return f"Anthropic API Error: {str(e)}"


class OllamaProvider(BaseLLMProvider):
    """Ollama local provider (free, fast)."""
    
    def __init__(self, model: str = "llama2", base_url: str = "http://localhost:11434"):
        super().__init__("Ollama")
        self.model = model
        self.base_url = base_url
        
        try:
            import requests
            self.requests = requests
        except ImportError:
            raise ImportError("Install requests package: pip install requests")
    
    async def acompletion_text(self, messages: List[Dict[str, str]], **kwargs) -> str:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(self.executor, self._make_completion, messages, kwargs)
    
    def completion_text(self, messages: List[Dict[str, str]], **kwargs) -> str:
        return self._make_completion(messages, kwargs)
    
    def _make_completion(self, messages: List[Dict[str, str]], kwargs: Dict) -> str:
        try:
            prompt = self._messages_to_prompt(messages)
            
            response = self.requests.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": self.model,
                    "prompt": prompt,
                    "stream": False
                },
                timeout=kwargs.get('timeout', 120)
            )
            
            if response.status_code == 200:
                return response.json()['response']
            else:
                return f"Ollama Error: {response.status_code} - {response.text}"
        except Exception as e:
            return f"Ollama Error: {str(e)}"


class FallbackProvider(BaseLLMProvider):
    """Fallback provider that tries multiple providers in order."""
    
    def __init__(self, providers: List[BaseLLMProvider]):
        super().__init__("Fallback")
        self.providers = providers
    
    async def acompletion_text(self, messages: List[Dict[str, str]], **kwargs) -> str:
        for provider in self.providers:
            try:
                result = await provider.acompletion_text(messages, **kwargs)
                
                # Check if result indicates an error
                if not any(error_term in result.lower() for error_term in 
                          ['error:', 'timeout', 'failed', 'exception']):
                    return f"[{provider.name}] {result}"
                
                print(f"⚠️ {provider.name} failed, trying next provider...")
                
            except Exception as e:
                print(f"❌ {provider.name} exception: {e}")
                continue
        
        return "All providers failed"
    
    def completion_text(self, messages: List[Dict[str, str]], **kwargs) -> str:
        return asyncio.run(self.acompletion_text(messages, **kwargs))


class SmartProviderFactory:
    """Factory to create optimal provider based on availability and use case."""
    
    @staticmethod
    def create_best_available(prefer_api: bool = True) -> BaseLLMProvider:
        """Create the best available provider."""
        
        providers = []
        
        if prefer_api:
            # Try API providers first (much faster)
            
            # Try OpenAI
            if os.getenv("OPENAI_API_KEY"):
                try:
                    providers.append(OpenAIProvider())
                    print("✅ OpenAI provider available")
                except Exception as e:
                    print(f"❌ OpenAI provider failed: {e}")
            
            # Try Anthropic
            if os.getenv("ANTHROPIC_API_KEY"):
                try:
                    providers.append(AnthropicProvider())
                    print("✅ Anthropic provider available")
                except Exception as e:
                    print(f"❌ Anthropic provider failed: {e}")
            
            # Try Ollama (local, free)
            try:
                import requests
                response = requests.get("http://localhost:11434/api/tags", timeout=5)
                if response.status_code == 200:
                    providers.append(OllamaProvider())
                    print("✅ Ollama provider available")
            except Exception:
                print("❌ Ollama not available")
        
        # Always add Claude Code as fallback
        try:
            providers.append(ClaudeCodeProvider(timeout=300))
            print("✅ Claude Code provider available")
        except Exception as e:
            print(f"❌ Claude Code provider failed: {e}")
        
        if not providers:
            raise RuntimeError("No LLM providers available!")
        
        if len(providers) == 1:
            return providers[0]
        else:
            return FallbackProvider(providers)
    
    @staticmethod
    def create_fast_provider() -> BaseLLMProvider:
        """Create fastest available provider."""
        
        # Priority: OpenAI > Anthropic > Ollama > Claude Code
        
        if os.getenv("OPENAI_API_KEY"):
            try:
                return OpenAIProvider()
            except:
                pass
        
        if os.getenv("ANTHROPIC_API_KEY"):
            try:
                return AnthropicProvider()
            except:
                pass
        
        try:
            import requests
            requests.get("http://localhost:11434/api/tags", timeout=2)
            return OllamaProvider()
        except:
            pass
        
        return ClaudeCodeProvider(timeout=180)
    
    @staticmethod
    def create_free_provider() -> BaseLLMProvider:
        """Create free provider (Ollama or Claude Code)."""
        
        try:
            import requests
            requests.get("http://localhost:11434/api/tags", timeout=2)
            return OllamaProvider()
        except:
            pass
        
        return ClaudeCodeProvider(timeout=300)


# Example usage and testing
async def test_providers():
    """Test different providers."""
    
    print("🧪 Testing LLM Providers")
    print("=" * 40)
    
    test_prompt = "Write a simple hello world function in Python. Keep it under 50 words."
    
    # Test available providers
    try:
        provider = SmartProviderFactory.create_best_available()
        print(f"\\n🚀 Using: {provider.name}")
        
        result = await provider.aask(test_prompt)
        print(f"✅ Result ({len(result)} chars): {result[:100]}...")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")


if __name__ == "__main__":
    asyncio.run(test_providers())