// Only a successful same-repository PR run of this workflow with exactly the
// current Git tree may supply the release. Missing/expired evidence fails closed.
module.exports = async function testedRun(github, repo, tree) {
  const { data } = await github.rest.actions.listWorkflowRuns({
    ...repo, workflow_id: 'pages.yml', event: 'pull_request', status: 'success', per_page: 100,
  })
  for (const run of data.workflow_runs) {
    if (run.conclusion !== 'success' || run.event !== 'pull_request' || run.head_repository?.full_name !== `${repo.owner}/${repo.repo}`) continue
    const commit = await github.rest.git.getCommit({ ...repo, commit_sha: run.head_sha })
    if (commit.data.tree.sha !== tree) continue
    const artifacts = await github.rest.actions.listWorkflowRunArtifacts({ ...repo, run_id: run.id })
    if (artifacts.data.artifacts.some(a => a.name === `tested-game-${tree}` && !a.expired)) return String(run.id)
  }
  return ''
}
