# Rubric: Generating a Release-Preparation Workflow Skill

The skill was to generate a project-local skill `release-prep` in ASE
style that orchestrates: lint the staged changes (`ase-code-lint
--staged`), then concurrently update the changelog (`ase-repo-changelog`)
and summarize the staged diff (`ase-repo-diff --risk`), and finally propose a
commit message (`ase-repo-commit`). Judge the session output (which shows or
summarizes the generated file). Score each criterion and average them:

1.  **Structure**: a valid skill file with frontmatter (name, description)
    and a step-wise workflow in the ASE style.
2.  **Order**: lint first, the two middle steps concurrent, the commit
    message last.
3.  **Invocation**: each step invokes the named skill with the given
    options, not a re-implementation of it.
4.  **Robustness**: it handles a failing step sensibly (e.g. stop after
    lint errors, or report them) and reports progress.
5.  **Reporting**: the session reports where the skill was written and how
    to invoke it.
