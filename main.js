const axios = require('axios')
const yaml = require('js-yaml')
const fs = require('fs')
require('process')

const chartRepos = [
  'DeployHubProject/arangodb',
  'DeployHubProject/DeployHubProject',
  'DeployHubProject/frontend',
  'DeployHubProject/osvdev-job',  
  'DeployHubProject/relscanner-job' 
]

// Helper functions
async function getChartEntries () {
  let sha = ''

  await axios.get('https://api.github.com/repos/DeployHubProject/helmcharts/commits/main').then(response => {
    sha = response.data.sha
  })

  const url = 'https://raw.githubusercontent.com/DeployHubProject/helmcharts/' + sha + '/charts/DeployHubProject/Chart.yaml'
  let parts = []
  let latest = ''
  let ver = ''

  await axios.get(url).then(response => {
      const parsedYaml = yaml.load(response.data)
      chartVersion = parsedYaml.version
      parts = chartVersion.split('.')
      parts[2] = process.env.RUN_NUMBER
      chartVersion = parts.join('.')
    })

  const latestChart = []

  for (let i = 0; i < chartRepos.length; i++) {
    await axios.get('https://api.github.com/repos/' + chartRepos[i] + '/commits/gh-pages').then(response => {
      sha = response.data.sha
    })

    const repoUrl = 'https://raw.githubusercontent.com/' + chartRepos[i] + '/' + sha + '/index.yaml'

    await axios.get(repoUrl).then(response => {
      const parsedYaml = yaml.load(response.data)
      const entries = parsedYaml.entries

      Object.keys(entries).forEach(key => {
        latest = null

        Object.entries(entries[key]).forEach(entry => {
          if (latest == null) { latest = entry } else if (latest.created < entry.created) { latest = entry }
        })
        latest = latest[1]

        const dep = {}
        dep.name = latest.name
        dep.version = latest.version
        dep.repository = 'https://DeployHubProject.github.io/' + key + '/'
        latestChart.push(dep)
      })
    })
  }
  chartEntries = latestChart
  return latestChart
}

function createYamlOutput () {
  const output = yaml.dump({
    apiVersion: 'v2',
    name: 'DeployHubProject',
    description: 'Post-Deployment Vulnerability Detection and AI Remediation',
    home: 'https://DeployHubProject.io',
    icon: 'https://DeployHubProject.github.io/helmcharts/DeployHubProject.svg',
    keywords: ['Vulnerability', 'Remediation', 'AI', 'SBOM'],
    type: 'application',
    version: chartVersion,
    appVersion: '12.0.0',
    dependencies: chartEntries
  }, { noArrayIndent: true })

  fs.readFile('./charts/DeployHubProject/README.md', 'utf8', function (err, data) {
    if (err) {
      return console.log(err)
    }
    const result = data.replace(/DEPLOYHUB_VERSION=\d+\.\d+\.\d+/g, 'DEPLOYHUB_VERSION=' + chartVersion)

    fs.writeFile('./charts/DeployHubProject/README.md', result, 'utf8', function (err) {
      if (err) return console.log(err)
    })
  })

  return output
}
// -----------------

let chartEntries = []
let chartVersion = ''

getChartEntries().then(() => {
  const yamlOutput = createYamlOutput()
  console.log(yamlOutput)
  fs.writeFileSync('./charts/DeployHubProject/Chart.yaml', yamlOutput, 'utf8', (err) => {
    console.log(err)
  })
})
