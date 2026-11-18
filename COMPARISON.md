ASE Test Run Comparison
=======================

Generated 2026-11-18T10:12:07Z from 16 run summaries, 6 models. Cells show passed/runs, mean cost per run, and mean duration per run (skipped runs excluded; costs of non-Anthropic gateway models are unreliable).

## Cases × Models

| case | claude-opus-5-5 | deepseek.v3.2 | global.openai.gpt-6-astra | global.openai.gpt-6-sol | moonshotai.kimi-k3.1 | qwen.qwen3-235b-a22b-2507-v1:0 |
|---|---|---|---|---|---|---|
| code/edit-sort-script | 2/2 $0.82 1m | 0/2 $1.99 3m | · | 2/2 $0.33 44s | 0/2 $0.00 22s | · |
| flow/brainstorm-grill-implement | 3/3 $2.42 5m | 0/3 $2.89 7m | · | 3/3 $3.06 4m | · | · |
| flow/csvq-grill | 2/2 $2.37 7m | 0/2 $2.09 3m | · | 0/2 $2.85 5m | · | · |
| meta/brainstorm-headless | 3/3 $0.45 59s | 2/3 $1.08 4m | · | 3/3 $0.36 43s | · | · |
| meta/mint-uuid | 4/4 $0.39 16s | 1/1 $0.60 2m | · | 0/1 $0.28 12s | · | · |
| one-shot | 0/2 $0.30 46s | · | · | · | · | · |
| plan-mode | 2/2 $0.83 2m | · | · | · | · | · |
| probe/call-order | 3/3 $0.32 22s | · | · | · | · | · |
| probe/compat | 4/4 $0.32 18s | 1/2 $0.70 2m | 1/2 $0.23 26s | · | · | 2/2 $0.36 20s |
| probe/getopt-error | 6/6 $0.38 13s | 3/3 $0.48 1m | 3/3 $0.27 11s | · | · | 1/3 $1.11 34s |
| probe/help | 6/6 $0.39 18s | 3/3 $0.30 1m | 3/3 $0.17 17s | · | · | 0/3 $0.11 9s |
| probe/task-status | 6/6 $0.34 11s | 3/3 $0.59 1m | 3/3 $0.27 13s | · | · | 3/3 $0.55 30s |
| probe/tool-leak | · | 0/3 $0.49 1m | · | · | · | 2/3 $0.60 33s |
| review/context-returns | 3/3 $0.87 1m | 0/3 $2.64 4m | · | 3/3 $0.82 2m | · | · |
| review/correctness-cents | 3/3 $0.64 1m | 0/3 $3.71 6m | · | 3/3 $0.67 1m | · | · |
| review/security-refunds | 3/3 $0.66 1m | 0/3 $4.16 14m | · | 3/3 $0.68 1m | · | · |
| task/edit-headless | 2/2 $0.85 50s | 0/1 $0.00 10m | · | 2/2 $0.78 39s | · | · |
| task/grill-llm | 1/1 $1.23 1m | · | · | 1/1 $0.85 1m | · | · |
| task/grill-scripted | 1/1 $0.92 59s | · | · | 1/1 $0.73 1m | · | · |
| task/grill-semantic | 1/1 $1.12 2m | · | · | 1/1 $0.86 2m | · | · |
| task/list-seeded | 1/1 $0.36 11s | · | · | 1/1 $0.28 8s | · | · |
| value/ase-grill | 2/2 $2.71 8m | · | · | · | · | · |
| value/one-shot | 0/2 $0.31 46s | · | · | · | · | · |
| value/plan-mode | 2/2 $0.73 2m | · | · | · | · | · |

## Case Groups × Models

| group | claude-opus-5-5 | deepseek.v3.2 | global.openai.gpt-6-astra | global.openai.gpt-6-sol | moonshotai.kimi-k3.1 | qwen.qwen3-235b-a22b-2507-v1:0 |
|---|---|---|---|---|---|---|
| code | 2/2 $0.82 1m | 0/2 $1.99 3m | · | 2/2 $0.33 44s | 0/2 $0.00 22s | · |
| flow | 5/5 $2.40 6m | 0/5 $2.57 5m | · | 3/5 $2.98 5m | · | · |
| meta | 7/7 $0.42 35s | 3/4 $0.96 3m | · | 3/4 $0.34 35s | · | · |
| one-shot | 0/2 $0.30 46s | · | · | · | · | · |
| plan-mode | 2/2 $0.83 2m | · | · | · | · | · |
| probe | 25/25 $0.35 16s | 10/14 $0.50 1m | 10/11 $0.24 16s | · | · | 8/14 $0.56 25s |
| review | 9/9 $0.73 1m | 0/9 $3.51 8m | · | 9/9 $0.72 1m | · | · |
| task | 6/6 $0.89 1m | 0/1 $0.00 10m | · | 6/6 $0.71 1m | · | · |
| value | 4/6 $1.25 3m | · | · | · | · | · |

## Runs over Time

| timestamp | model | version | cases | runs | cost | duration | aborted |
|---|---|---|---|---|---|---|---|
| 2026-11-16T07-37-07 | claude-opus-5-5 | 19b6f27a | 9/9 | 15/15 | $15.95 | 29m |  |
| 2026-11-16T08-17-33 | claude-opus-5-5 | 19b6f27a | 3/3 | 9/9 | $6.54 | 12m |  |
| 2026-11-16T12-01-24 | claude-opus-5-5 | 19b6f27a | 5/5 | 12/12 | $4.70 | 3m |  |
| 2026-11-16T12-04-09 | claude-opus-5-5 | 19b6f27a | 4/4 | 11/11 | $3.57 | 2m |  |
| 2026-11-16T18-26-38 | deepseek.v3.2 | 3236c653 | 2/13 | 3/21 | $54.71 | 2h | yes |
| 2026-11-16T19-01-38 | global.openai.gpt-6-astra | 3236c653 | 3/4 | 10/11 | $2.59 | 2m |  |
| 2026-11-16T19-09-35 | global.openai.gpt-6-sol | 3236c653 | 11/13 | 23/26 | $27.68 | 51m |  |
| 2026-11-16T19-31-54 | claude-opus-5-5 | 19b6f27a | 2/3 | 4/6 | $7.48 | 22m |  |
| 2026-11-16T19-54-04 | claude-opus-5-5 | 19b6f27a | 1/2 | 2/4 | $2.26 | 7m |  |
| 2026-11-16T19-57-32 | claude-opus-5-5 | 19b6f27a | 1/1 | 2/2 | $4.75 | 14m |  |
| 2026-11-16T20-35-38 | deepseek.v3.2 | 3236c653 | 3/5 | 10/14 | $7.98 | 21m |  |
| 2026-11-17T02-26-35 | qwen.qwen3-235b-a22b-2507-v1:0 | 3236c653 | 3/5 | 8/14 | $7.85 | 6m |  |
| 2026-11-17T02-50-40 | moonshotai.kimi-k3.1 | 3236c653 | 0/1 | 0/2 | $10.00 | 44s |  |
| 2026-11-17T09-16-23 | claude-opus-5-5 | 19b6f27a | 1/1 | 1/1 | $0.47 | 16s |  |
| 2026-11-17T09-16-49 | claude-opus-5-5 | 19b6f27a | 1/1 | 1/1 | $0.36 | 15s |  |
| 2026-11-18T10-07-56 | claude-opus-5-5 | 2.1.1 | 1/1 | 3/3 | $0.96 | 1m |  |
