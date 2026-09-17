"""Service layer package for Nexus.

Each sub-package provides the business logic for one feature domain:

- ``llm``: BYOK LLM completions and SSE streaming via kitkat.

Future services (e.g. ``rag``, ``embeddings``) are added as sibling
sub-packages with their own ``__init__.py`` and ``schemas.py`` without
touching this file or any existing service package.
"""
