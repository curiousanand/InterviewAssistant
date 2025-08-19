#!/usr/bin/env python3
"""
Custom Claude Code LLM Provider for MetaGPT
This provider integrates Claude Code CLI with MetaGPT's agent framework.
"""

import subprocess
import json
import tempfile
import os
from typing import List, Dict, Any, Optional
from pathlib import Path
import asyncio
from concurrent.futures import ThreadPoolExecutor

class ClaudeCodeLLM:
    """
    Custom LLM provider that uses Claude Code CLI instead of API calls.
    This allows MetaGPT to leverage Claude Code's local capabilities.
    """
    
    def __init__(self, project_path: Optional[str] = None):
        """
        Initialize Claude Code LLM provider.
        
        Args:
            project_path: Optional path to project for context-aware responses
        """
        self.project_path = project_path or os.getcwd()
        self.executor = ThreadPoolExecutor(max_workers=1)
        
    def _run_claude_command(self, prompt: str, use_context: bool = True) -> str:
        """
        Execute Claude Code command and return response.
        
        Args:
            prompt: The prompt to send to Claude
            use_context: Whether to include project context
            
        Returns:
            Claude's response text
        """
        try:
            # Prepare command - use --print for non-interactive mode
            cmd = ['claude', '--print', prompt]
            
            # Execute command
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=180,  # 3 minute timeout for complex tasks
                cwd=self.project_path if use_context else None
            )
            
            if result.returncode == 0:
                return result.stdout.strip()
            else:
                # Fallback to basic response on error
                return f"Error executing Claude Code: {result.stderr}"
                
        except subprocess.TimeoutExpired:
            return "Claude Code request timed out"
        except FileNotFoundError:
            return "Claude Code CLI not found. Please ensure it's installed and in PATH."
        except Exception as e:
            return f"Unexpected error: {str(e)}"
    
    async def acompletion_text(self, messages: List[Dict[str, str]], **kwargs) -> str:
        """
        Async completion method compatible with MetaGPT's LLM interface.
        
        Args:
            messages: List of message dictionaries with 'role' and 'content'
            **kwargs: Additional parameters (ignored for now)
            
        Returns:
            Completion text from Claude Code
        """
        # Convert messages to single prompt
        prompt = self._messages_to_prompt(messages)
        
        # Run Claude Code command asynchronously
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            self.executor, 
            self._run_claude_command, 
            prompt, 
            True
        )
        
        return result
    
    def completion_text(self, messages: List[Dict[str, str]], **kwargs) -> str:
        """
        Synchronous completion method.
        
        Args:
            messages: List of message dictionaries
            **kwargs: Additional parameters
            
        Returns:
            Completion text from Claude Code
        """
        prompt = self._messages_to_prompt(messages)
        return self._run_claude_command(prompt)
    
    def _messages_to_prompt(self, messages: List[Dict[str, str]]) -> str:
        """
        Convert OpenAI-style messages to a single prompt for Claude Code.
        
        Args:
            messages: List of message dictionaries
            
        Returns:
            Formatted prompt string
        """
        if not messages:
            return ""
        
        # Handle different message formats
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
            else:
                prompt_parts.append(f"{role}: {content}")
        
        return "\n\n".join(prompt_parts)
    
    # Additional methods to match MetaGPT LLM interface
    async def aask(self, prompt: str, **kwargs) -> str:
        """Simple ask method for compatibility."""
        messages = [{"role": "user", "content": prompt}]
        return await self.acompletion_text(messages, **kwargs)
    
    def ask(self, prompt: str, **kwargs) -> str:
        """Synchronous ask method."""
        messages = [{"role": "user", "content": prompt}]
        return self.completion_text(messages, **kwargs)


class ContextAwareClaudeCodeLLM(ClaudeCodeLLM):
    """
    Enhanced version that provides project context to Claude Code.
    """
    
    def __init__(self, project_path: Optional[str] = None):
        super().__init__(project_path)
        self.context_cache = {}
    
    def _get_project_context(self) -> str:
        """
        Generate project context summary for Claude Code.
        
        Returns:
            Project context string
        """
        if not self.project_path or not os.path.exists(self.project_path):
            return ""
        
        context_parts = []
        
        # Add basic project info
        context_parts.append(f"Project Path: {self.project_path}")
        
        # Look for common files
        common_files = [
            'README.md', 'package.json', 'requirements.txt', 
            'pom.xml', 'Cargo.toml', '.env', 'CLAUDE.md'
        ]
        
        found_files = []
        for file in common_files:
            file_path = os.path.join(self.project_path, file)
            if os.path.exists(file_path):
                found_files.append(file)
        
        if found_files:
            context_parts.append(f"Key files present: {', '.join(found_files)}")
        
        return "\n".join(context_parts)
    
    def _run_claude_command(self, prompt: str, use_context: bool = True) -> str:
        """
        Enhanced command execution with project context.
        """
        if use_context:
            context = self._get_project_context()
            if context:
                enhanced_prompt = f"""
Project Context:
{context}

Task:
{prompt}

Please provide a response considering the project context above.
"""
                return super()._run_claude_command(enhanced_prompt, False)
        
        return super()._run_claude_command(prompt, use_context)


# Example usage and testing functions
def test_claude_code_llm():
    """Test the Claude Code LLM provider."""
    print("Testing Claude Code LLM Provider...")
    
    # Initialize LLM
    llm = ClaudeCodeLLM()
    
    # Test basic functionality
    messages = [
        {"role": "user", "content": "What is 2 + 2?"}
    ]
    
    try:
        response = llm.completion_text(messages)
        print(f"Response: {response}")
        return True
    except Exception as e:
        print(f"Test failed: {e}")
        return False


async def test_async_claude_code_llm():
    """Test async functionality."""
    print("Testing Async Claude Code LLM...")
    
    llm = ContextAwareClaudeCodeLLM()
    
    messages = [
        {"role": "system", "content": "You are a helpful programming assistant."},
        {"role": "user", "content": "Explain what a REST API is in simple terms."}
    ]
    
    try:
        response = await llm.acompletion_text(messages)
        print(f"Async Response: {response}")
        return True
    except Exception as e:
        print(f"Async test failed: {e}")
        return False


if __name__ == "__main__":
    # Run basic tests
    print("=" * 50)
    print("Claude Code LLM Provider Test Suite")
    print("=" * 50)
    
    # Test sync version
    sync_test = test_claude_code_llm()
    
    # Test async version
    import asyncio
    async_test = asyncio.run(test_async_claude_code_llm())
    
    print("\n" + "=" * 50)
    print(f"Sync Test: {'PASSED' if sync_test else 'FAILED'}")
    print(f"Async Test: {'PASSED' if async_test else 'FAILED'}")
    print("=" * 50)