#!/usr/bin/env python3
"""
Test simple implementation generation
"""

import asyncio
from claude_code_llm import ClaudeCodeLLM

async def test_simple_implementation():
    llm = ClaudeCodeLLM()
    
    # Very focused, simple prompt
    prompt = """Create a basic todo app implementation. Provide:

1. Simple HTML structure with input and list
2. Basic CSS for styling
3. JavaScript for add/delete functionality

Keep it concise and functional."""
    
    print("Testing simple implementation...")
    try:
        response = await llm.acompletion_text([{"role": "user", "content": prompt}])
        print(f"Success! Response length: {len(response)}")
        print(f"Preview:\n{response[:500]}...")
        
        # Save to file
        with open("simple_implementation.md", "w") as f:
            f.write("# Simple Implementation\n\n")
            f.write(response)
        
        print("Saved to simple_implementation.md")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_simple_implementation())