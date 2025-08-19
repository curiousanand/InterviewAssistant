#!/usr/bin/env python3
"""
MetaGPT with Multi-LLM Provider Support
Solves timeout issues by using faster LLM APIs when available
"""

import asyncio
import os
import sys
from typing import List, Dict
from pathlib import Path
from multi_llm_provider import SmartProviderFactory, BaseLLMProvider

class BaseRole:
    """Base role class with multi-LLM support."""
    
    def __init__(self, llm: BaseLLMProvider, name: str, profile: str):
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
        
        # Add recent context
        if self.memory:
            recent_memory = "\\n".join(self.memory[-2:])
            messages.insert(1, {"role": "system", "content": f"Context: {recent_memory}"})
        
        # Use async completion with timeout handling
        try:
            response = await asyncio.wait_for(
                self.llm.acompletion_text(messages),
                timeout=120  # 2 minute timeout for API calls
            )
        except asyncio.TimeoutError:
            response = f"Task timed out for {self.name}. Consider breaking into smaller steps."
        
        # Manage memory
        self.memory.append(f"{self.name}: {response[:200]}...")
        if len(self.memory) > 3:
            self.memory = self.memory[-2:]
        
        return response
    
    def _get_role_prompt(self) -> str:
        return "Provide helpful and accurate responses."

class ProductManager(BaseRole):
    def __init__(self, llm: BaseLLMProvider):
        super().__init__(llm, "ProductManager", "Product Manager")
    
    def _get_role_prompt(self) -> str:
        return """You are an experienced Product Manager. Focus on clear, actionable requirements.
        Keep responses focused and practical. Limit to 500 words max."""

class Architect(BaseRole):
    def __init__(self, llm: BaseLLMProvider):
        super().__init__(llm, "Architect", "Software Architect")
    
    def _get_role_prompt(self) -> str:
        return """You are a Senior Software Architect. Design practical, implementable solutions.
        Focus on technical clarity and feasibility. Limit to 800 words max."""

class FrontendEngineer(BaseRole):
    def __init__(self, llm: BaseLLMProvider):
        super().__init__(llm, "FrontendEngineer", "Frontend Engineer")
    
    def _get_role_prompt(self) -> str:
        return """You are a Frontend Engineer specialized in HTML, CSS, and JavaScript.
        Create clean, working code with modern practices. Focus on one component at a time."""

class BackendEngineer(BaseRole):
    def __init__(self, llm: BaseLLMProvider):
        super().__init__(llm, "BackendEngineer", "Backend Engineer")
    
    def _get_role_prompt(self) -> str:
        return """You are a Backend Engineer. Focus on data persistence, API design, and server logic.
        Provide practical, working solutions. Keep code examples concise."""

class QualityAssurance(BaseRole):
    def __init__(self, llm: BaseLLMProvider):
        super().__init__(llm, "QualityAssurance", "QA Engineer")
    
    def _get_role_prompt(self) -> str:
        return """You are a QA Engineer. Design practical testing strategies.
        Focus on essential test cases and real-world scenarios. Limit to 600 words max."""

class FastTeam:
    """Team with optimized LLM provider selection."""
    
    def __init__(self, project_path: str = None, prefer_api: bool = True):
        self.project_path = project_path or os.getcwd()
        self.prefer_api = prefer_api
        self.roles = {}
        
        # Create optimized LLM provider
        print("🔍 Selecting optimal LLM provider...")
        if prefer_api:
            self.llm = SmartProviderFactory.create_fast_provider()
        else:
            self.llm = SmartProviderFactory.create_free_provider()
        
        print(f"✅ Using: {self.llm.name}")
    
    def hire(self, roles: List[BaseRole]):
        """Add roles to the team."""
        for role in roles:
            self.roles[role.name] = role
            print(f"✅ Hired {role.name} ({role.profile})")
    
    async def run_fast_project(self, project_description: str) -> Dict[str, str]:
        """Execute project with optimized workflow."""
        print(f"\\n🚀 Fast Project Execution: {project_description}")
        print("=" * 60)
        
        results = {}
        
        # Concurrent execution where possible
        tasks = []
        
        # Phase 1: Planning (can run in parallel)
        if "ProductManager" in self.roles and "Architect" in self.roles:
            print("\\n📋 PHASE 1: CONCURRENT PLANNING")
            print("-" * 35)
            
            # Run requirements and architecture in parallel
            pm_task = self._run_requirements(project_description)
            arch_task = self._run_architecture(project_description)
            
            pm_result, arch_result = await asyncio.gather(pm_task, arch_task)
            results["requirements"] = pm_result
            results["architecture"] = arch_result
        
        # Phase 2: Implementation (sequential for dependencies)
        print("\\n💻 PHASE 2: OPTIMIZED IMPLEMENTATION")
        print("-" * 42)
        
        impl_results = await self._run_optimized_implementation(project_description)
        results.update(impl_results)
        
        # Phase 3: Testing (can run while implementation finishes)
        if "QualityAssurance" in self.roles:
            print("\\n🧪 PHASE 3: TESTING STRATEGY")
            print("-" * 32)
            
            qa_result = await self._run_testing(project_description)
            results["testing"] = qa_result
        
        print("\\n⚡ Fast Project Execution Complete!")
        return results
    
    async def _run_requirements(self, project_description: str) -> str:
        """Run requirements gathering."""
        print("  📋 Product Manager working...")
        instruction = f"""
        Project: {project_description}
        
        Define focused requirements:
        1. Core features (3-5 main features only)
        2. Key user stories 
        3. Success criteria
        
        Be concise and actionable. Max 400 words.
        """
        result = await self.roles["ProductManager"].run(instruction)
        print(f"    ✓ Requirements: {len(result)} characters")
        return result
    
    async def _run_architecture(self, project_description: str) -> str:
        """Run architecture design."""
        print("  🏗️ Architect working...")
        instruction = f"""
        Project: {project_description}
        
        Provide technical design:
        1. Technology stack
        2. File structure
        3. Component architecture
        
        Keep it practical. Max 600 words.
        """
        result = await self.roles["Architect"].run(instruction)
        print(f"    ✓ Architecture: {len(result)} characters")
        return result
    
    async def _run_optimized_implementation(self, project_description: str) -> Dict[str, str]:
        """Run implementation with optimized steps."""
        impl_results = {}
        
        steps = [
            ("html_structure", "Create semantic HTML structure for the application. Include all necessary elements and proper accessibility attributes. Keep it clean and focused."),
            ("css_styling", "Create modern CSS styling. Focus on clean design, responsive layout, and good UX. Use modern CSS practices."),
            ("javascript_core", "Create core JavaScript functionality. Focus on main features and clean, working code. Include proper error handling."),
            ("integration", "Create final integrated application combining HTML, CSS, and JavaScript into one working file.")
        ]
        
        for step_name, instruction in steps:
            print(f"  ⚡ {step_name.replace('_', ' ').title()}...")
            
            full_instruction = f"""
            For project: {project_description}
            
            {instruction}
            
            Keep response focused and under 800 words.
            """
            
            try:
                if "FrontendEngineer" in self.roles:
                    result = await self.roles["FrontendEngineer"].run(full_instruction)
                    impl_results[step_name] = result
                    print(f"    ✓ {step_name}: {len(result)} characters")
                else:
                    impl_results[step_name] = "No frontend engineer available"
            except Exception as e:
                impl_results[step_name] = f"Error in {step_name}: {str(e)}"
                print(f"    ❌ {step_name} failed: {e}")
        
        return impl_results
    
    async def _run_testing(self, project_description: str) -> str:
        """Run testing strategy."""
        print("  🧪 QA Engineer working...")
        instruction = f"""
        For project: {project_description}
        
        Design testing approach:
        1. Core functionality tests
        2. User acceptance criteria
        3. Browser compatibility
        
        Keep it practical. Max 500 words.
        """
        result = await self.roles["QualityAssurance"].run(instruction)
        print(f"    ✓ Testing: {len(result)} characters")
        return result
    
    def save_results(self, results: Dict[str, str], output_dir: str = "fast_output"):
        """Save results with proper file extensions."""
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        print(f"\\n📁 Saving to {output_dir}/")
        
        for key, content in results.items():
            if "html" in key.lower() or "integration" in key.lower():
                file_path = output_path / f"{key}.html"
            elif "css" in key.lower():
                file_path = output_path / f"{key}.css"
            elif "javascript" in key.lower() or "js" in key.lower():
                file_path = output_path / f"{key}.js"
            else:
                file_path = output_path / f"{key}.md"
            
            with open(file_path, "w", encoding='utf-8') as f:
                if file_path.suffix == ".md":
                    f.write(f"# {key.replace('_', ' ').title()}\\n\\n")
                f.write(content)
            
            print(f"  📄 {file_path.name}")

class WebAppFastTeam(FastTeam):
    """Pre-configured fast team for web apps."""
    
    def __init__(self, project_path: str = None, prefer_api: bool = True):
        super().__init__(project_path, prefer_api)
        
        self.hire([
            ProductManager(self.llm),
            Architect(self.llm),
            FrontendEngineer(self.llm),
            BackendEngineer(self.llm),
            QualityAssurance(self.llm)
        ])

# Example workflows
async def run_fast_todo():
    """Run fast todo project."""
    print("⚡ Fast Todo Application")
    team = WebAppFastTeam(prefer_api=True)
    
    description = """
    Create a modern todo list application with:
    - Add/delete todos
    - Mark as complete
    - Filter by status
    - Local storage persistence
    """
    
    results = await team.run_fast_project(description)
    
    import datetime
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    team.save_results(results, f"fast_todo_{timestamp}")
    
    return results

async def run_custom_fast(description: str):
    """Run custom fast project."""
    team = WebAppFastTeam(prefer_api=True)
    results = await team.run_fast_project(description)
    
    import datetime
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    team.save_results(results, f"fast_custom_{timestamp}")
    
    return results

async def test_provider_speed():
    """Test different providers for speed."""
    print("🏃 Provider Speed Test")
    print("=" * 30)
    
    test_prompt = "Create a simple HTML form with name and email fields. Keep it under 100 words."
    
    providers = []
    
    # Test available providers
    try:
        providers.append(SmartProviderFactory.create_fast_provider())
    except:
        pass
    
    try:
        from multi_llm_provider import ClaudeCodeProvider
        providers.append(ClaudeCodeProvider(timeout=60))
    except:
        pass
    
    for provider in providers:
        print(f"\\n🧪 Testing {provider.name}...")
        
        start_time = asyncio.get_event_loop().time()
        try:
            result = await provider.aask(test_prompt)
            end_time = asyncio.get_event_loop().time()
            
            duration = end_time - start_time
            print(f"  ⏱️ Duration: {duration:.2f}s")
            print(f"  📄 Result: {len(result)} chars")
            print(f"  ✅ Success: {result[:100]}...")
            
        except Exception as e:
            print(f"  ❌ Failed: {e}")

# CLI Interface
async def main():
    """Enhanced CLI with speed options."""
    print("⚡ Fast MetaGPT + Multi-LLM Integration")
    print("=" * 45)
    
    if len(sys.argv) > 1:
        command = sys.argv[1]
        
        if command == "todo":
            await run_fast_todo()
        elif command == "speed-test":
            await test_provider_speed()
        elif command == "custom":
            if len(sys.argv) > 2:
                description = " ".join(sys.argv[2:])
                await run_custom_fast(description)
            else:
                print("Usage: python metagpt_multi_llm.py custom 'description'")
        else:
            print("Available commands:")
            print("  todo        - Fast todo app")
            print("  speed-test  - Test provider speeds")
            print("  custom      - Custom project")
    else:
        print("Choose an option:")
        print("1. Fast todo app")
        print("2. Speed test providers")
        print("3. Custom project")
        
        choice = input("\\nEnter choice (1-3): ").strip()
        
        if choice == "1":
            await run_fast_todo()
        elif choice == "2":
            await test_provider_speed()
        elif choice == "3":
            description = input("Enter project description: ").strip()
            await run_custom_fast(description)

if __name__ == "__main__":
    asyncio.run(main())