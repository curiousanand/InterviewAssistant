#!/usr/bin/env python3
"""
Improved MetaGPT + Claude Code Integration
This version breaks down implementation into smaller, focused steps to avoid timeouts.
"""

import asyncio
import os
import sys
from typing import List, Dict
from pathlib import Path
from claude_code_llm import ClaudeCodeLLM, ContextAwareClaudeCodeLLM

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
        
        # Only use recent memory to avoid context overflow
        if self.memory:
            recent_memory = "\\n".join(self.memory[-2:])
            messages.insert(1, {"role": "system", "content": f"Context: {recent_memory}"})
        
        response = await self.llm.acompletion_text(messages)
        
        # Keep memory manageable
        self.memory.append(f"{self.name}: {response[:200]}...")  # Store summary only
        if len(self.memory) > 5:
            self.memory = self.memory[-3:]  # Keep only last 3
        
        return response
    
    def _get_role_prompt(self) -> str:
        return "Provide helpful and accurate responses."

class ProductManager(BaseRole):
    def __init__(self, llm: ClaudeCodeLLM):
        super().__init__(llm, "ProductManager", "Product Manager")
    
    def _get_role_prompt(self) -> str:
        return """You are an experienced Product Manager. Focus on clear, actionable requirements.
        Keep responses focused and practical."""

class Architect(BaseRole):
    def __init__(self, llm: ClaudeCodeLLM):
        super().__init__(llm, "Architect", "Software Architect")
    
    def _get_role_prompt(self) -> str:
        return """You are a Senior Software Architect. Design practical, implementable solutions.
        Focus on technical clarity and feasibility."""

class FrontendEngineer(BaseRole):
    def __init__(self, llm: ClaudeCodeLLM):
        super().__init__(llm, "FrontendEngineer", "Frontend Engineer")
    
    def _get_role_prompt(self) -> str:
        return """You are a Frontend Engineer specialized in HTML, CSS, and JavaScript.
        Create clean, working code with modern practices. Keep responses focused and implementable."""

class BackendEngineer(BaseRole):
    def __init__(self, llm: ClaudeCodeLLM):
        super().__init__(llm, "BackendEngineer", "Backend Engineer")
    
    def _get_role_prompt(self) -> str:
        return """You are a Backend Engineer. Focus on data persistence, API design, and server logic.
        Provide practical, working solutions."""

class QualityAssurance(BaseRole):
    def __init__(self, llm: ClaudeCodeLLM):
        super().__init__(llm, "QualityAssurance", "QA Engineer")
    
    def _get_role_prompt(self) -> str:
        return """You are a QA Engineer. Design practical testing strategies.
        Focus on essential test cases and real-world scenarios."""

class ImprovedTeam:
    """Enhanced team orchestrator with step-by-step implementation."""
    
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
    
    async def run_complete_project(self, project_description: str) -> Dict[str, str]:
        """Execute a complete project workflow with step-by-step implementation."""
        print(f"\\n🚀 Starting Complete Project: {project_description}")
        print("=" * 70)
        
        results = {}
        
        # Phase 1: Planning
        print("\\n📋 PHASE 1: PLANNING")
        print("-" * 30)
        
        if "ProductManager" in self.roles:
            print("\\n📋 Product Manager - Defining Requirements...")
            pm_instruction = f"""
            Project: {project_description}
            
            Define clear, focused requirements:
            1. Core features (3-5 main features)
            2. User stories (key user interactions)
            3. Success criteria
            
            Keep it concise and actionable.
            """
            results["requirements"] = await self.roles["ProductManager"].run(pm_instruction)
            print(f"✓ Requirements: {len(results['requirements'])} characters")
        
        if "Architect" in self.roles:
            print("\\n🏗️ Architect - System Design...")
            # Use only core requirements, not full text
            core_req = results.get('requirements', project_description)[:500] + "..." if len(results.get('requirements', '')) > 500 else results.get('requirements', project_description)
            
            arch_instruction = f"""
            Based on: {core_req}
            
            Provide technical design:
            1. Technology stack (specific tools)
            2. File structure
            3. Component architecture
            4. Data flow
            
            Keep it practical and implementable.
            """
            results["architecture"] = await self.roles["Architect"].run(arch_instruction)
            print(f"✓ Architecture: {len(results['architecture'])} characters")
        
        # Phase 2: Step-by-Step Implementation
        print("\\n💻 PHASE 2: STEP-BY-STEP IMPLEMENTATION")
        print("-" * 45)
        
        implementation_results = await self._run_step_by_step_implementation(project_description)
        results.update(implementation_results)
        
        # Phase 3: Quality Assurance
        print("\\n🧪 PHASE 3: QUALITY ASSURANCE")
        print("-" * 35)
        
        if "QualityAssurance" in self.roles:
            print("\\n🧪 QA Engineer - Testing Strategy...")
            qa_instruction = f"""
            For project: {project_description}
            
            Design focused testing approach:
            1. Core functionality tests
            2. User acceptance criteria
            3. Browser/device testing
            4. Performance guidelines
            
            Keep it practical and actionable.
            """
            results["testing"] = await self.roles["QualityAssurance"].run(qa_instruction)
            print(f"✓ Testing Strategy: {len(results['testing'])} characters")
        
        print("\\n✅ Complete Project Workflow Finished!")
        return results
    
    async def _run_step_by_step_implementation(self, project_description: str) -> Dict[str, str]:
        """Break implementation into focused, manageable steps."""
        impl_results = {}
        
        # Step 1: HTML Structure
        if "FrontendEngineer" in self.roles:
            print("\\n  📄 Step 1: HTML Structure...")
            html_instruction = f"""
            Create HTML structure for: {project_description}
            
            Provide:
            1. Complete HTML file with semantic structure
            2. All necessary form elements
            3. Container elements for dynamic content
            4. Proper accessibility attributes
            
            Focus on clean, semantic HTML. No CSS or JavaScript yet.
            """
            impl_results["html_structure"] = await self.roles["FrontendEngineer"].run(html_instruction)
            print(f"    ✓ HTML Structure: {len(impl_results['html_structure'])} characters")
        
        # Step 2: CSS Styling
        if "FrontendEngineer" in self.roles:
            print("\\n  🎨 Step 2: CSS Styling...")
            css_instruction = f"""
            Create CSS styling for the todo application.
            
            Provide:
            1. Complete CSS with modern styling
            2. Responsive design (mobile-first)
            3. Clean typography and spacing
            4. Interactive states (hover, focus)
            5. Color scheme and visual hierarchy
            
            Make it look professional and user-friendly.
            """
            impl_results["css_styling"] = await self.roles["FrontendEngineer"].run(css_instruction)
            print(f"    ✓ CSS Styling: {len(impl_results['css_styling'])} characters")
        
        # Step 3: Core JavaScript
        if "FrontendEngineer" in self.roles:
            print("\\n  ⚡ Step 3: Core JavaScript...")
            js_core_instruction = f"""
            Create core JavaScript functionality for todo app.
            
            Provide:
            1. Add todo function
            2. Delete todo function
            3. DOM manipulation helpers
            4. Input validation
            5. Event listeners setup
            
            Focus on core CRUD operations. Clean, commented code.
            """
            impl_results["javascript_core"] = await self.roles["FrontendEngineer"].run(js_core_instruction)
            print(f"    ✓ Core JavaScript: {len(impl_results['javascript_core'])} characters")
        
        # Step 4: Local Storage Integration
        if "BackendEngineer" in self.roles:
            print("\\n  💾 Step 4: Data Persistence...")
            storage_instruction = f"""
            Create localStorage integration for todo app.
            
            Provide:
            1. Save todos to localStorage
            2. Load todos on page load
            3. Update storage on changes
            4. Error handling for storage issues
            5. Data validation and sanitization
            
            Ensure data persists between sessions.
            """
            impl_results["data_persistence"] = await self.roles["BackendEngineer"].run(storage_instruction)
            print(f"    ✓ Data Persistence: {len(impl_results['data_persistence'])} characters")
        
        # Step 5: Advanced Features
        if "FrontendEngineer" in self.roles:
            print("\\n  🎯 Step 5: Advanced Features...")
            advanced_instruction = f"""
            Add advanced features to todo app.
            
            Provide:
            1. Mark todos as complete/incomplete
            2. Filter todos (all, active, completed)
            3. Todo counter
            4. Clear completed function
            5. Edit todo functionality
            
            Enhance user experience with these features.
            """
            impl_results["advanced_features"] = await self.roles["FrontendEngineer"].run(advanced_instruction)
            print(f"    ✓ Advanced Features: {len(impl_results['advanced_features'])} characters")
        
        # Step 6: Integration & Polish
        if "FrontendEngineer" in self.roles:
            print("\\n  🔗 Step 6: Final Integration...")
            integration_instruction = f"""
            Create final integrated todo app file.
            
            Provide complete, working HTML file that includes:
            1. All HTML structure
            2. All CSS styling
            3. All JavaScript functionality
            4. Proper file organization
            5. Code comments and documentation
            
            Create one complete, production-ready file.
            """
            impl_results["final_integration"] = await self.roles["FrontendEngineer"].run(integration_instruction)
            print(f"    ✓ Final Integration: {len(impl_results['final_integration'])} characters")
        
        return impl_results
    
    def save_results(self, results: Dict[str, str], output_dir: str = "output_improved"):
        """Save all results to organized files."""
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        print(f"\\n📁 Saving results to {output_dir}/")
        print("-" * 40)
        
        for role, content in results.items():
            # Create appropriate file extension based on content type
            if "html" in role.lower():
                file_path = output_path / f"{role}.html" 
            elif "css" in role.lower():
                file_path = output_path / f"{role}.css"
            elif "javascript" in role.lower() or "js" in role.lower():
                file_path = output_path / f"{role}.js"
            else:
                file_path = output_path / f"{role}.md"
            
            with open(file_path, "w", encoding='utf-8') as f:
                if file_path.suffix == ".md":
                    f.write(f"# {role.replace('_', ' ').title()}\\n\\n")
                f.write(content)
            
            print(f"  📄 {file_path.name} ({len(content)} chars)")
        
        print(f"\\n✅ All results saved to {output_dir}/")

# Specialized workflows
class WebAppTeam(ImprovedTeam):
    """Specialized team for web application development."""
    
    def __init__(self, project_path: str = None):
        super().__init__(project_path)
        
        # Auto-hire specialized web development team
        self.hire([
            ProductManager(self.llm),
            Architect(self.llm),
            FrontendEngineer(self.llm),
            BackendEngineer(self.llm),
            QualityAssurance(self.llm)
        ])

class APITeam(ImprovedTeam):
    """Specialized team for API development."""
    
    def __init__(self, project_path: str = None):
        super().__init__(project_path)
        
        self.hire([
            ProductManager(self.llm),
            Architect(self.llm),
            BackendEngineer(self.llm),
            QualityAssurance(self.llm)
        ])

# Example usage functions
async def run_webapp_project(description: str):
    """Run a complete web application project."""
    print("🌐 Web Application Development Team")
    team = WebAppTeam()
    
    results = await team.run_complete_project(description)
    
    import datetime
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    team.save_results(results, f"webapp_output_{timestamp}")
    
    return results

async def run_simple_todo_project():
    """Run the optimized todo project."""
    description = """
    Create a modern, responsive todo list web application with:
    - Add and delete todos
    - Mark todos as complete/incomplete  
    - Filter todos by status
    - Persistent storage using localStorage
    - Clean, modern UI design
    """
    
    return await run_webapp_project(description)

async def run_custom_project(description: str):
    """Run a custom project with the improved workflow."""
    team = WebAppTeam()
    results = await team.run_complete_project(description)
    
    import datetime
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    team.save_results(results, f"custom_output_{timestamp}")
    
    return results

# CLI interface
async def main():
    """Enhanced CLI interface."""
    print("🤖 Improved MetaGPT + Claude Code Integration")
    print("=" * 55)
    
    if len(sys.argv) > 1:
        command = sys.argv[1]
        
        if command == "todo":
            print("🎯 Running optimized todo project...")
            await run_simple_todo_project()
        elif command == "webapp":
            if len(sys.argv) > 2:
                description = " ".join(sys.argv[2:])
                await run_webapp_project(description)
            else:
                print("Usage: python metagpt_improved.py webapp 'your project description'")
        elif command == "test":
            llm = ClaudeCodeLLM()
            response = llm.ask("Create a simple hello world HTML page")
            print(f"Claude Code Test: {response}")
        else:
            print(f"Unknown command: {command}")
            print("Available commands:")
            print("  todo          - Run optimized todo app project")
            print("  webapp 'desc' - Run custom web app project")  
            print("  test          - Test Claude Code connection")
    else:
        print("Choose an option:")
        print("1. Run optimized todo app project")
        print("2. Run custom web app project")
        print("3. Test Claude Code connection")
        
        choice = input("\\nEnter choice (1-3): ").strip()
        
        if choice == "1":
            await run_simple_todo_project()
        elif choice == "2":
            description = input("Enter project description: ").strip()
            await run_custom_project(description)
        elif choice == "3":
            llm = ClaudeCodeLLM()
            response = llm.ask("Create a simple hello world HTML page")
            print(f"Claude Code Test: {response}")
        else:
            print("Invalid choice")

if __name__ == "__main__":
    asyncio.run(main())