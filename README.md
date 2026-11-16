ASE Suit for Evaluation (ASE)
======================


This repository is part of [**ASE**](https://github.com/rse/ase) and has
to be checked out as a direct subdirectory of it (e.g. `ase-eval/`), as the harness loads
the `plugin/` and the built `tool/` of the surrounding **ASE** working
copy.


## Quickstart

1. First checkout this repo into the [**ASE**](https://github.com/rse/ase) repo:
```
cd <path/to/ase>
git clone https://github.com/rse/ase-eval.git # executed inside ASE repo dir
```
2. Install the dependecies:
```
cd ase-eval
npm install # executed inside the ase-eval dir
```

3. Run the tests
```
# run against the models claude code uses
./run_all_tests.sh
./run_agent_test.sh
# run against model reachable via some LLM proxy (e.g. local models):
./run_agent_test_local.sh
./run_agent_test_local.sh
```
4. Force a specific model; this is especially useful when testing against a
liteLLM proxy.
```
# first run claude to see what models are available:
# either you just type /model in claude to see the list, or use this one-liner: 
echo '{"type":"control_request","request_id":"1","request":{"subtype":"initialize"}}' \
  | claude -p --input-format stream-json --output-format stream-json --verbose 2>/dev/null \
  | jq -r 'select(.type=="control_response") | .response.response.models[] | "\(.value)\t\(.resolvedModel // "")\t\(.displayName)"'

# once you know the name of the model, you can force it: 
./run_all_tests.sh --force-model <model name>
# examples: 
./run_all_tests.sh --force-model eu.anthropic.claude-sonnet-5
./run_all_tests.sh --force-model global.openai.gpt-6-sol
./run_all_tests.sh --force-model deepseek.v3.2

# this basically aliases all models to this specific model

```


## Running the Tests

Prerequisites: a fully built `tool/` (`cd ../tool && npm start build`)
and Anthropic credentials (`ANTHROPIC_API_KEY`, `CLAUDE_CODE_OAUTH_TOKEN`,
or a regular `claude` login). Every run burns real AI tokens.

### With a Cloud LLM (Anthropic API)

```
./run_all_tests.sh                                # all cases, after a cost confirmation
./run_all_tests.sh --cases='review/*' --jobs=6    # only matching cases, 6 runs in parallel
./run_all_tests.sh -K                             # keep the sandboxes of failed runs
./run_all_tests.sh --max-cost-usd=60              # raise the global cost ceiling (default $20)
./run_all_tests.sh --force-model claude-opus-5-5  # force all models onto one model
npm start test -- -l                              # list the cases (free)
npm start test -- -d --cases='meta/*'             # describe input and oracles of cases (free)
./run_agent_test.sh                               # "ase agent" end-to-end tests
```

### With a Local LLM (Anthropic-compatible gateway, e.g. LiteLLM)

```
cp etc/llm-local.env.sample etc/llm-local.env     # set ANTHROPIC_BASE_URL and ANTHROPIC_API_KEY
./run_all_tests_local.sh [<profile>]              # all cases through the gateway
./run_agent_test_local.sh [<profile>]             # "ase agent" end-to-end tests through the gateway
npm start test -- --llm=etc/llm-local.env --cases=meta/mint-uuid
```

Local runs are much slower, and the reported costs are meaningless for
non-Anthropic models. See `LOCAL_SETUP.md` for a complete gateway setup
and `TESTS.md` ("Third-Party Gateways") for the details.

Exit codes: `0` all cases passed, `1` a case failed its pass@k
threshold, `2` infrastructure error or cost ceiling hit. Results land in
`results/<timestamp>/`.

## Adding a Test

1.  Create a directory `cases/<group>/<name>/`, e.g. `cases/meta/mint-uuid/`.
2.  Write its `case.yaml`:

    ```yaml
    skill: ase-meta-mint
    args: "uuid test harness fixture"
    budget: { maxUsd: 1.00 }
    oracles:
      - notErrored: true
      - regex:
          in: output
          match: "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
    ```

3.  Check it for free: `npm start test -- --describe --cases=meta/mint-uuid`.
4.  Run it: `npm start test -- -K --cases=meta/mint-uuid`.
5.  For non-deterministic skills, set `runs` and `minPass` (e.g. `3`/`2`).

Optional files next to `case.yaml`: `fixture/` (seeded files and task
plans), `answers.yaml` or `persona.md` (simulated user), `rubric.md`,
`expected-*.md`, `oracle.py`, `suite/`. Available oracles: `notErrored`,
`verdict`, `regex`, `fileExists`, `gitDiff`, `taskStore`, `textMetric`,
`exec`, `suite`, `rubric`, `similar`, `review`. The existing cases are
the best templates; the full contract is in `TESTS.md` ("Contract") and
the authoritative schema in `src/ase-test-case.ts`.

## Layout

-   `src/`: the harness (`ase-test.ts` CLI plus `ase-test-*.ts` modules)
-   `src/review/`: the scorer and standalone tools of the review benchmark
-   `cases/<group>/<name>/`: the test cases (`code`, `flow`, `meta`,
    `review`, `task`)
-   `agent/`: the `ase agent` end-to-end tests
-   `docs/review/`: documentation and measurement log of the review benchmark
-   `etc/`: stx tasks, lint config, gateway profile sample
-   `results/`: run artifacts and summaries (never committed)
-   `run_*.sh`: the run scripts

## Further Documentation

| File | Content |
|---|---|
| [`TESTS.md`](TESTS.md) | usage, gateways, case format, contract, sandboxing |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | visual overview: execution, architecture, adding a test |
| [`TECH_OVERVIEW.md`](TECH_OVERVIEW.md) | execution flow, framework vs. harness, touchpoints with ASE |
| [`LOCAL_SETUP.md`](LOCAL_SETUP.md) | local model setup (LiteLLM proxy, MLX server) |
| [`EXAMPLE_RUNS.md`](EXAMPLE_RUNS.md) | example runs on Anthropic and local models |
| [`docs/review/README.md`](docs/review/README.md) | the review benchmark |
| [`cases/review/MIGRATION.md`](cases/review/MIGRATION.md) | origin and migration of the review benchmark |
