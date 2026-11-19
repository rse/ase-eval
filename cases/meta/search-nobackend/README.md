# meta/search-nobackend

`ase-meta-search` in an environment without any web search backend: the
gateway behind the sandboxes offers no `WebSearch` tool, and no search MCP
server (Perplexity, Brave, Exa) is configured. The `ase-meta-search`
sub-agent allows only those tools, so the skill must stop with
`ERROR: no search backend available` and must *not* answer from model
knowledge (no PEP number in the output). Once a backend exists, replace this
case by a real search case (answer: Python 3.10, PEP 634).
