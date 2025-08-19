# MetaGPT + Claude Code Integration Guide

This guide provides a complete step-by-step process to integrate MetaGPT with Claude Code, allowing you to use Claude Code's local capabilities within MetaGPT's multi-agent framework.

## Overview

**What you'll achieve:**
- Use Claude Code (CLI) instead of Anthropic API with MetaGPT
- Create multi-agent workflows using local Claude Code
- Build context-aware agents that understand your codebase
- Run complete software development projects with AI agents

## Prerequisites

- Claude Code CLI installed and configured
- Python 3.8+ with pip
- Basic understanding of Python and async programming

## Step-by-Step Implementation

### Step 1: Install MetaGPT (Minimal Setup)

```bash
# Install MetaGPT without heavy dependencies
pip install --no-deps metagpt

# Install essential dependencies only
pip install pydantic loguru typer
```

**Note:** We use `--no-deps` to avoid dependency conflicts and install only what we need.

### Step 2: Create Claude Code LLM Provider

Create `claude_code_llm.py`:

```python
#!/usr/bin/env python3
"""
Custom Claude Code LLM Provider for MetaGPT
"""

import subprocess
import os
from typing import List, Dict, Optional
import asyncio
from concurrent.futures import ThreadPoolExecutor

class ClaudeCodeLLM:
    """LLM provider that uses Claude Code CLI instead of API calls."""
    
    def __init__(self, project_path: Optional[str] = None):
        self.project_path = project_path or os.getcwd()
        self.executor = ThreadPoolExecutor(max_workers=1)
        
    def _run_claude_command(self, prompt: str, use_context: bool = True) -> str:
        """Execute Claude Code command and return response."""
        try:
            # Use --print for non-interactive mode
            cmd = ['claude', '--print', prompt]
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=60,
                cwd=self.project_path if use_context else None
            )
            
            if result.returncode == 0:
                return result.stdout.strip()
            else:
                return f"Error executing Claude Code: {result.stderr}"
                
        except subprocess.TimeoutExpired:
            return "Claude Code request timed out"
        except Exception as e:
            return f"Unexpected error: {str(e)}"
    
    async def acompletion_text(self, messages: List[Dict[str, str]], **kwargs) -> str:
        """Async completion method compatible with MetaGPT."""
        prompt = self._messages_to_prompt(messages)
        
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            self.executor, 
            self._run_claude_command, 
            prompt, 
            True
        )
        
        return result
    
    def completion_text(self, messages: List[Dict[str, str]], **kwargs) -> str:
        """Synchronous completion method."""
        prompt = self._messages_to_prompt(messages)
        return self._run_claude_command(prompt)
    
    def _messages_to_prompt(self, messages: List[Dict[str, str]]) -> str:
        """Convert OpenAI-style messages to single prompt."""
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
    
    # Compatibility methods
    async def aask(self, prompt: str, **kwargs) -> str:
        messages = [{"role": "user", "content": prompt}]
        return await self.acompletion_text(messages, **kwargs)
    
    def ask(self, prompt: str, **kwargs) -> str:
        messages = [{"role": "user", "content": prompt}]
        return self.completion_text(messages, **kwargs)

# Enhanced version with project context
class ContextAwareClaudeCodeLLM(ClaudeCodeLLM):
    """Enhanced version that provides project context to Claude Code."""
    
    def _get_project_context(self) -> str:
        """Generate project context summary."""
        if not self.project_path or not os.path.exists(self.project_path):
            return ""
        
        context_parts = [f"Project Path: {self.project_path}"]
        
        # Look for common files
        common_files = [
            'README.md', 'package.json', 'requirements.txt', 
            'pom.xml', 'Cargo.toml', '.env', 'CLAUDE.md'
        ]
        
        found_files = []
        for file in common_files:
            if os.path.exists(os.path.join(self.project_path, file)):
                found_files.append(file)
        
        if found_files:
            context_parts.append(f"Key files present: {', '.join(found_files)}")
        
        return "\\n".join(context_parts)
    
    def _run_claude_command(self, prompt: str, use_context: bool = True) -> str:
        """Enhanced command execution with project context."""
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
```

### Step 3: Create MetaGPT Integration

Create `metagpt_claude_integration.py`:

```python
#!/usr/bin/env python3
"""
MetaGPT + Claude Code Integration
"""

import asyncio
import os
import sys
from typing import List, Dict
from pathlib import Path
from claude_code_llm import ClaudeCodeLLM, ContextAwareClaudeCodeLLM

# MetaGPT-compatible role implementations
class BaseRole:
    """Base role class compatible with MetaGPT patterns."""
    
    def __init__(self, llm: ClaudeCodeLLM, name: str, profile: str):
        self.llm = llm
        self.name = name
        self.profile = profile
        self.memory = []
    
    async def run(self, instruction: str) -> str:
        """Execute the role's primary function."""
        messages = [
            {"role": "system", "content": f"You are a {self.profile}. {self._get_role_prompt()}"},
            {"role": "user", "content": instruction}
        ]
        
        if self.memory:
            memory_context = "\\n".join(self.memory[-3:])
            messages.insert(1, {"role": "system", "content": f"Previous context: {memory_context}"})
        
        response = await self.llm.acompletion_text(messages)
        self.memory.append(f"{self.name}: {response}")
        
        return response
    
    def _get_role_prompt(self) -> str:
        return "Provide helpful and accurate responses."

class ProductManager(BaseRole):
    def __init__(self, llm: ClaudeCodeLLM):
        super().__init__(llm, "ProductManager", "Product Manager")
    
    def _get_role_prompt(self) -> str:
        return """You are an experienced Product Manager. Define clear requirements,
        user stories, priorities, and specifications that developers can implement."""

class Architect(BaseRole):
    def __init__(self, llm: ClaudeCodeLLM):
        super().__init__(llm, "Architect", "Software Architect")
    
    def _get_role_prompt(self) -> str:
        return """You are a Senior Software Architect. Design system architecture,
        technical specifications, and implementation plans considering scalability and maintainability."""

class Engineer(BaseRole):
    def __init__(self, llm: ClaudeCodeLLM):
        super().__init__(llm, "Engineer", "Software Engineer")
    
    def _get_role_prompt(self) -> str:
        return """You are an experienced Software Engineer. Implement clean,
        maintainable code based on specifications, following best practices."""

class QualityAssurance(BaseRole):
    def __init__(self, llm: ClaudeCodeLLM):
        super().__init__(llm, "QualityAssurance", "QA Engineer")
    
    def _get_role_prompt(self) -> str:
        return """You are a Quality Assurance Engineer. Design comprehensive
        test plans, test cases, and quality assurance strategies."""

class Team:
    """Team orchestrator for multi-agent workflows."""
    
    def __init__(self, project_path: str = None):
        self.project_path = project_path or os.getcwd()
        self.llm = ContextAwareClaudeCodeLLM(self.project_path)
        self.roles = {}
        self.workflow_history = []
    
    def hire(self, roles: List[BaseRole]):
        """Add roles to the team."""
        for role in roles:
            self.roles[role.name] = role
            print(f"✅ Hired {role.name} ({role.profile})")
    
    async def run_project(self, project_description: str) -> Dict[str, str]:
        """Execute a complete project workflow."""
        print(f"\\n🚀 Starting project: {project_description}")
        print("=" * 60)
        
        results = {}
        
        # Step 1: Product Manager defines requirements
        if "ProductManager" in self.roles:
            print("\\n📋 Product Manager - Defining Requirements...")
            pm_instruction = f"""
            Project: {project_description}
            
            Please define:
            1. Core requirements and features
            2. User stories with acceptance criteria
            3. Success metrics
            4. Project scope and timeline
            """
            results["requirements"] = await self.roles["ProductManager"].run(pm_instruction)
            print(f"Requirements defined: {len(results['requirements'])} characters")
        
        # Step 2: Architect designs the system
        if "Architect" in self.roles:
            print("\\n🏗️ Architect - Designing System...")
            arch_instruction = f"""
            Based on these requirements:
            {results.get('requirements', project_description)}
            
            Please provide:
            1. System architecture design
            2. Component breakdown
            3. Technology stack recommendations
            4. API specifications
            5. Database schema (if needed)
            """
            results["architecture"] = await self.roles["Architect"].run(arch_instruction)
            print(f"Architecture designed: {len(results['architecture'])} characters")
        
        # Step 3: Engineer implements the solution
        if "Engineer" in self.roles:
            print("\\n💻 Engineer - Implementing Code...")
            eng_instruction = f"""
            Requirements: {results.get('requirements', '')}
            Architecture: {results.get('architecture', '')}
            
            Please implement:
            1. Core functionality code
            2. Key components and modules
            3. Configuration files
            4. Documentation comments
            """
            results["implementation"] = await self.roles["Engineer"].run(eng_instruction)
            print(f"Implementation completed: {len(results['implementation'])} characters")
        
        # Step 4: QA designs testing strategy
        if "QualityAssurance" in self.roles:
            print("\\n🧪 QA Engineer - Designing Tests...")
            qa_instruction = f"""
            Project details:
            Requirements: {results.get('requirements', '')}
            Implementation: {results.get('implementation', '')}
            
            Please provide:
            1. Test plan and strategy
            2. Unit test cases
            3. Integration test scenarios
            4. End-to-end test flows
            """
            results["testing"] = await self.roles["QualityAssurance"].run(qa_instruction)
            print(f"Testing strategy completed: {len(results['testing'])} characters")
        
        print("\\n✅ Project workflow completed!")
        return results
    
    def save_results(self, results: Dict[str, str], output_dir: str = "output"):
        """Save project results to files."""
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        for role, content in results.items():
            file_path = output_path / f"{role}.md"
            with open(file_path, "w") as f:
                f.write(f"# {role.title()}\\n\\n")
                f.write(content)
            print(f"📄 Saved {role} results to {file_path}")

# CLI interface
async def main():
    """Main CLI interface."""
    print("🤖 MetaGPT + Claude Code Integration")
    print("=" * 50)
    
    if len(sys.argv) > 1:
        command = sys.argv[1]
        
        if command == "simple":
            await run_simple_project()
        elif command == "analyze":
            await run_context_project()
        elif command == "test":
            llm = ClaudeCodeLLM()
            response = llm.ask("Hello! Are you working correctly?")
            print(f"Claude Code Response: {response}")
        else:
            print(f"Unknown command: {command}")
            print("Available commands: simple, analyze, test")
    else:
        print("Choose an option:")
        print("1. Run simple todo app project")
        print("2. Analyze current codebase") 
        print("3. Test Claude Code connection")
        
        choice = input("\\nEnter choice (1-3): ").strip()
        
        if choice == "1":
            await run_simple_project()
        elif choice == "2":
            await run_context_project()
        elif choice == "3":
            llm = ClaudeCodeLLM()
            response = llm.ask("Hello! Are you working correctly?")
            print(f"Claude Code Response: {response}")

async def run_simple_project():
    """Run a simple project example."""
    team = Team()
    llm = ClaudeCodeLLM()
    
    team.hire([
        ProductManager(llm),
        Architect(llm),
        Engineer(llm),
        QualityAssurance(llm)
    ])
    
    project_description = """
    Create a simple todo list application that allows users to:
    - Add new tasks
    - Mark tasks as completed
    - Delete tasks
    - Filter tasks by status
    - Save tasks to local storage
    """
    
    results = await team.run_project(project_description)
    team.save_results(results)

async def run_context_project():
    """Run a project with current codebase context."""
    current_dir = os.getcwd()
    team = Team(current_dir)
    llm = ContextAwareClaudeCodeLLM(current_dir)
    
    team.hire([Architect(llm), Engineer(llm)])
    
    project_description = """
    Analyze the current project and suggest practical improvements
    that can be implemented incrementally.
    """
    
    results = await team.run_project(project_description)
    
    import datetime
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    team.save_results(results, f"output/analysis_{timestamp}")

if __name__ == "__main__":
    asyncio.run(main())
```

### Step 4: Usage Examples

#### Basic Test
```bash
python metagpt_claude_integration.py test
```

#### Simple Project
```bash
python metagpt_claude_integration.py simple
```

#### Context-Aware Analysis
```bash
python metagpt_claude_integration.py analyze
```

#### Interactive Mode
```bash
python metagpt_claude_integration.py
```

## Key Features

### 1. Local Claude Code Integration
- Uses Claude Code CLI instead of API calls
- No API keys or tokens required
- Works offline with local Claude Code

### 2. Context-Aware Agents
- Agents understand your current project structure
- Automatic project context injection
- File-based knowledge integration

### 3. Multi-Agent Workflows
- Product Manager: Requirements and specifications
- Architect: System design and architecture
- Engineer: Code implementation
- QA Engineer: Testing strategies

### 4. Flexible Output
- Results saved to markdown files
- Structured project documentation
- Reusable team configurations

## Advanced Features

### Custom Roles
```python
class DevOpsEngineer(BaseRole):
    def __init__(self, llm: ClaudeCodeLLM):
        super().__init__(llm, "DevOpsEngineer", "DevOps Engineer")
    
    def _get_role_prompt(self) -> str:
        return """You are a DevOps Engineer. Design deployment pipelines,
        infrastructure, and monitoring solutions."""

# Add to team
team.hire([DevOpsEngineer(llm)])
```

### Custom Workflows
```python
async def custom_workflow(team: Team, description: str):
    """Create your own workflow steps."""
    
    # Step 1: Analysis
    analysis = await team.roles["Architect"].run(f"Analyze: {description}")
    
    # Step 2: Implementation
    implementation = await team.roles["Engineer"].run(f"Implement: {analysis}")
    
    # Step 3: Testing
    testing = await team.roles["QualityAssurance"].run(f"Test: {implementation}")
    
    return {"analysis": analysis, "implementation": implementation, "testing": testing}
```

### Project-Specific Configurations
```python
class ProjectSpecificTeam(Team):
    def __init__(self, project_type: str):
        super().__init__()
        
        if project_type == "web":
            self.hire([WebDeveloper(self.llm), UIDesigner(self.llm)])
        elif project_type == "api":
            self.hire([BackendEngineer(self.llm), APIDesigner(self.llm)])
```

## Troubleshooting

### Common Issues

1. **Claude Code not found**
   ```bash
   # Ensure Claude Code is in PATH
   which claude
   
   # Or provide full path in code
   cmd = ['/path/to/claude', '--print', prompt]
   ```

2. **Permission errors**
   ```bash
   # Check Claude Code permissions
   claude doctor
   ```

3. **Timeout issues**
   ```python
   # Increase timeout for complex tasks
   result = subprocess.run(cmd, timeout=120)  # 2 minutes
   ```

4. **Memory issues with large projects**
   ```python
   # Limit memory usage
   self.memory = self.memory[-5:]  # Keep only last 5 interactions
   ```

## Best Practices

1. **Project Structure**
   - Keep role definitions modular
   - Use clear naming conventions
   - Separate business logic from UI

2. **Error Handling**
   - Always handle subprocess errors
   - Provide fallback responses
   - Log errors for debugging

3. **Performance**
   - Use async operations for parallel processing
   - Limit conversation memory
   - Cache common responses

4. **Context Management**
   - Provide relevant project context
   - Avoid overwhelming prompts
   - Use structured instructions

## Conclusion

This integration allows you to:
- ✅ Use Claude Code locally with MetaGPT
- ✅ Create sophisticated multi-agent workflows
- ✅ Build context-aware development teams
- ✅ Generate complete project documentation
- ✅ Avoid API costs and rate limits

The system is extensible and can be adapted for various project types and workflows. Start with the simple examples and gradually build more complex agent interactions as needed.