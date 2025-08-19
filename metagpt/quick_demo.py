#!/usr/bin/env python3
"""
Quick demonstration of the improved step-by-step implementation
"""

import asyncio
from claude_code_llm import ClaudeCodeLLM

async def demo_step_by_step():
    """Demonstrate the step-by-step approach working."""
    llm = ClaudeCodeLLM()
    
    print("🚀 Quick Demo: Step-by-Step Implementation")
    print("=" * 50)
    
    steps = [
        {
            "name": "HTML Structure",
            "prompt": "Create basic HTML structure for a todo app. Include input field, add button, and container for todo list. Keep it simple and semantic.",
            "file": "demo_structure.html"
        },
        {
            "name": "CSS Styling", 
            "prompt": "Create modern CSS for a todo app. Include clean typography, card design, and responsive layout. Keep it under 100 lines.",
            "file": "demo_styles.css"
        },
        {
            "name": "JavaScript Core",
            "prompt": "Create JavaScript functions for todo app: addTodo(), deleteTodo(), renderTodos(). Include basic DOM manipulation. Keep it functional and clean.",
            "file": "demo_script.js"
        }
    ]
    
    results = {}
    
    for i, step in enumerate(steps, 1):
        print(f"\\n📋 Step {i}: {step['name']}")
        print("-" * 30)
        
        try:
            result = await llm.acompletion_text([
                {"role": "user", "content": step["prompt"]}
            ])
            
            results[step["name"]] = result
            
            # Save individual files
            with open(step["file"], "w") as f:
                f.write(result)
            
            print(f"✅ Generated {step['name']}: {len(result)} characters")
            print(f"💾 Saved to: {step['file']}")
            
        except Exception as e:
            print(f"❌ Error in {step['name']}: {e}")
            results[step["name"]] = f"Error: {e}"
    
    # Create combined file
    print(f"\\n🔗 Creating Combined File...")
    print("-" * 30)
    
    combined_prompt = f"""
    Combine these components into one complete HTML file:
    
    HTML: {results.get('HTML Structure', '')[:200]}...
    CSS: {results.get('CSS Styling', '')[:200]}...
    JS: {results.get('JavaScript Core', '')[:200]}...
    
    Create a single, working todo app file.
    """
    
    try:
        combined = await llm.acompletion_text([
            {"role": "user", "content": combined_prompt}
        ])
        
        with open("demo_complete.html", "w") as f:
            f.write(combined)
        
        print(f"✅ Complete App: {len(combined)} characters")
        print(f"💾 Saved to: demo_complete.html")
        
    except Exception as e:
        print(f"❌ Error combining: {e}")
    
    print(f"\\n🎉 Demo Complete!")
    print("Files generated:")
    print("  - demo_structure.html")
    print("  - demo_styles.css") 
    print("  - demo_script.js")
    print("  - demo_complete.html")

if __name__ == "__main__":
    asyncio.run(demo_step_by_step())