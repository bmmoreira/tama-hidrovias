"""Setup configuration for tama_hidrovias package."""

from setuptools import setup, find_packages

with open("README.md", encoding="utf-8") as fh:
    long_description = fh.read()

with open("requirements.txt", encoding="utf-8") as fh:
    requirements = [
        line.strip()
        for line in fh
        if line.strip() and not line.startswith("#")
    ]

setup(
    name="tama_hidrovias",
    version="0.1.0",
    author="tama-hidrovias contributors",
    description="Python data pipeline for the tama-hidrovias hydrology platform",
    long_description=long_description,
    long_description_content_type="text/markdown",
    packages=find_packages(exclude=["tests*"]),
    python_requires=">=3.10",
    install_requires=requirements,
    classifiers=[
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Topic :: Scientific/Engineering :: Hydrology",
    ],
    entry_points={
        "console_scripts": [
            "tama-pipeline=tama_hidrovias.automation.pipeline:main",
        ],
    },
)
