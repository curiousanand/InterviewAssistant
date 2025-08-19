#!/usr/bin/env python3
"""
Setup script for My LLM project
"""

from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

with open("requirements.txt", "r", encoding="utf-8") as fh:
    requirements = [line.strip() for line in fh if line.strip() and not line.startswith("#")]

setup(
    name="my-llm",
    version="0.1.0",
    author="Your Name",
    author_email="your.email@example.com",
    description="A comprehensive Large Language Model implementation and training framework",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/yourusername/my-llm",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "Intended Audience :: Science/Research",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Topic :: Scientific/Engineering :: Artificial Intelligence",
        "Topic :: Software Development :: Libraries :: Python Modules",
    ],
    python_requires=">=3.8",
    install_requires=requirements,
    extras_require={
        "dev": [
            "pytest>=7.3.0",
            "black>=23.3.0",
            "isort>=5.12.0",
            "flake8>=6.0.0",
            "mypy>=1.3.0",
        ],
        "notebook": [
            "jupyter>=1.0.0",
            "ipykernel>=6.23.0",
            "matplotlib>=3.7.0",
            "seaborn>=0.12.0",
        ],
        "optimization": [
            "onnx>=1.14.0",
            "onnxruntime>=1.15.0",
            "optimum>=1.8.0",
            "tensorrt>=8.6.0",
        ],
    },
    entry_points={
        "console_scripts": [
            "my-llm-train=training.trainers.main:main",
            "my-llm-eval=evaluation.evaluate:main",
            "my-llm-serve=inference.api.server:main",
            "my-llm-chat=inference.cli.chat:main",
        ],
    },
    include_package_data=True,
    zip_safe=False,
)