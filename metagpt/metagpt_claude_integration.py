#!/usr/bin/env python3
"""
MetaGPT + Claude Code Integration
This script demonstrates how to use Claude Code with MetaGPT's multi-agent system.
"""

import asyncio
import os
import sys
from typing import List, Dict, Any
from pathlib import Path

# Import our custom Claude Code LLM
from claude_code_llm import ClaudeCodeLLM, ContextAwareClaudeCodeLLM

# Minimal MetaGPT-compatible role implementations
class BaseRole:
    """Base role class compatible with MetaGPT patterns."""
    
    def __init__(self, llm: ClaudeCodeLLM, name: str, profile: str):
        self.llm = llm
        self.name = name
        self.profile = profile
        self.memory = []
    
    async def run(self, instruction: str) -> str:
        """Execute the role's primary function."""
        # Add role-specific system message
        messages = [
            {"role": "system", "content": f"You are a {self.profile}. {self._get_role_prompt()}"},
            {"role": "user", "content": instruction}
        ]
        
        # Add memory context if available
        if self.memory:
            memory_context = "\n".join(self.memory[-3:])  # Last 3 memories
            messages.insert(1, {"role": "system", "content": f"Previous context: {memory_context}"})
        
        # Get response from Claude Code
        response = await self.llm.acompletion_text(messages)
        
        # Store in memory
        self.memory.append(f"{self.name}: {response}")
        
        return response
    
    def _get_role_prompt(self) -> str:
        """Override in subclasses to define role-specific behavior."""
        return "Provide helpful and accurate responses."


class ProductManager(BaseRole):
    """Product Manager role using Claude Code."""
    
    def __init__(self, llm: ClaudeCodeLLM):
        super().__init__(llm, "ProductManager", "Product Manager")
    
    def _get_role_prompt(self) -> str:
        return """You are an experienced Product Manager. Your role is to:
        - Define product requirements and user stories
        - Prioritize features based on user value
        - Create clear, actionable specifications
        - Consider technical feasibility and business goals
        
        Provide structured, clear requirements that developers can implement."""


class Architect(BaseRole):
    """Software Architect role using Claude Code."""
    
    def __init__(self, llm: ClaudeCodeLLM):
        super().__init__(llm, "Architect", "Software Architect")
    
    def _get_role_prompt(self) -> str:
        return """You are a Senior Software Architect. Your role is to:
        - Design system architecture and component interactions
        - Define technical specifications and APIs
        - Consider scalability, maintainability, and performance
        - Create implementation plans and technical documentation
        
        Provide detailed technical designs that engineers can follow."""


class Engineer(BaseRole):
    """Software Engineer role using Claude Code."""
    
    def __init__(self, llm: ClaudeCodeLLM):
        super().__init__(llm, "Engineer", "Software Engineer")
    
    def _get_role_prompt(self) -> str:
        return """You are an experienced Software Engineer. Your role is to:
        - Implement code based on specifications
        - Follow best practices and coding standards
        - Write clean, maintainable, and tested code
        - Consider edge cases and error handling
        
        Provide actual code implementations with explanations."""


class QualityAssurance(BaseRole):
    """QA Engineer role using Claude Code."""
    
    def __init__(self, llm: ClaudeCodeLLM):
        super().__init__(llm, "QualityAssurance", "QA Engineer")
    
    def _get_role_prompt(self) -> str:
        return """You are a Quality Assurance Engineer. Your role is to:
        - Design test plans and test cases
        - Identify potential bugs and edge cases
        - Define acceptance criteria
        - Ensure quality standards are met
        
        Provide comprehensive testing strategies and test cases."""


class Team:
    """Simple team orchestrator for multi-agent workflows."""
    
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
        print(f"\n🚀 Starting project: {project_description}")
        print("=" * 60)
        
        results = {}
        
        # Step 1: Product Manager defines requirements
        if "ProductManager" in self.roles:
            print("\n📋 Product Manager - Defining Requirements...")
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
            print("\n🏗️ Architect - Designing System...")
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
            print("\n💻 Engineer - Implementing Code...")
            # Break down into smaller, focused task to avoid timeouts
            eng_instruction = f"""
            Based on the project requirements, please provide:
            
            1. Main application structure (HTML/CSS/JS files)
            2. Core JavaScript functions for task management
            3. LocalStorage integration code
            4. Basic styling approach
            
            Focus on a working implementation with clean, commented code.
            Keep response concise but functional.
            """
            results["implementation"] = await self.roles["Engineer"].run(eng_instruction)
            print(f"Implementation completed: {len(results['implementation'])} characters")
        
        # Step 4: QA designs testing strategy
        if "QualityAssurance" in self.roles:
            print("\n🧪 QA Engineer - Designing Tests...")
            # Simplified testing instruction to avoid timeouts
            qa_instruction = f"""
            For a todo list application, please provide:
            
            1. Essential test cases for CRUD operations
            2. UI/UX testing checklist
            3. Browser compatibility testing approach
            4. Basic performance testing guidelines
            
            Keep it practical and focused on the core functionality.
            """
            results["testing"] = await self.roles["QualityAssurance"].run(qa_instruction)
            print(f"Testing strategy completed: {len(results['testing'])} characters")
        
        # Store workflow history
        self.workflow_history.append({
            "project": project_description,
            "results": results,
            "timestamp": asyncio.get_event_loop().time()
        })
        
        print("\n✅ Project workflow completed!")
        return results
    
    def save_results(self, results: Dict[str, str], output_dir: str = "output"):
        """Save project results to files."""
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        for role, content in results.items():
            file_path = output_path / f"{role}.md"
            with open(file_path, "w") as f:
                f.write(f"# {role.title()}\n\n")
                f.write(content)
            print(f"📄 Saved {role} results to {file_path}")


# Example usage functions
async def example_simple_project():
    """Run a simple project example."""
    print("🔍 Example: Simple Todo Application")
    
    # Create team
    team = Team()
    
    # Create LLM instance
    llm = ClaudeCodeLLM()
    
    # Hire team members
    team.hire([
        ProductManager(llm),
        Architect(llm),
        Engineer(llm),
        QualityAssurance(llm)
    ])
    
    # Run project
    project_description = """
    Create a simple todo list application that allows users to:
    - Add new tasks
    - Mark tasks as completed
    - Delete tasks
    - Filter tasks by status
    - Save tasks to local storage
    
    The application should be web-based with a clean, responsive UI.
    """
    
    results = await team.run_project(project_description)
    
    # Save results
    team.save_results(results)
    
    return results


async def example_context_aware_project():
    """Run a project with current codebase context."""
    print("🎯 Example: Context-Aware Project Enhancement")
    
    # Create team with current project context
    current_dir = os.getcwd()
    team = Team(current_dir)
    
    # Create context-aware LLM
    llm = ContextAwareClaudeCodeLLM(current_dir)
    
    # Hire smaller team for focused task
    team.hire([
        Architect(llm),
        Engineer(llm)
    ])
    
    # Run context-aware project
    project_description = """
    Analyze the current InterviewAssistant project and suggest:
    1. Performance optimizations for the real-time audio processing
    2. Enhanced error handling for WebSocket connections
    3. Improved user experience features
    4. Code refactoring opportunities
    
    Focus on practical improvements that can be implemented incrementally.
    """
    
    results = await team.run_project(project_description)
    
    # Save results with timestamp
    import datetime
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    team.save_results(results, f"output/analysis_{timestamp}")
    
    return results


# CLI interface
async def main():
    """Main CLI interface."""
    print("🤖 MetaGPT + Claude Code Integration")
    print("=" * 50)
    
    if len(sys.argv) > 1:
        command = sys.argv[1]
        
        if command == "simple":
            await example_simple_project()
        elif command == "analyze":
            await example_context_aware_project()
        elif command == "test":
            # Test Claude Code connection
            llm = ClaudeCodeLLM()
            response = llm.ask("Hello! Are you working correctly?")
            print(f"Claude Code Response: {response}")
        else:
            print(f"Unknown command: {command}")
            print("Available commands: simple, analyze, test")
    else:
        # Interactive mode
        print("Choose an option:")
        print("1. Run simple todo app project")
        print("2. Analyze current codebase") 
        print("3. Test Claude Code connection")
        
        choice = input("\nEnter choice (1-3): ").strip()
        
        if choice == "1":
            await example_simple_project()
        elif choice == "2":
            await example_context_aware_project()
        elif choice == "3":
            llm = ClaudeCodeLLM()
            response = llm.ask("Hello! Are you working correctly?")
            print(f"Claude Code Response: {response}")
        else:
            print("Invalid choice")


if __name__ == "__main__":
    asyncio.run(main())