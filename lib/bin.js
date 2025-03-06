#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const sade = require('sade');
const shell = require('shelljs');

const DEFAULT_OUTPUT_DIR = 'lib';
const DEFAULT_PUBLISH_CONFIG = {
    access: 'public',
    registry: 'https://registry.npmjs.org/',
};
const DEFAULT_LICENSE = 'Apache-2.0';

const OPENAPI_GENERATOR_CLI_COMMAND = `npx @openapitools/openapi-generator-cli`;
const {
    bin: [CLI_NAME],
    version: CLI_VERSION,
} = require('../package.json');
const REPO_PACKAGE_JSON = require(path.join(process.cwd(), 'package.json'));
const LIBRARY_NAME = REPO_PACKAGE_JSON.name;

function getReplacedDependenciesVersion(dependencies, version = '*') {
    return Object.fromEntries((Object.keys(dependencies) || []).map((dep) => [dep, version]));
}

function updatePackageJson(packageJsonPath, updateFn) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return fs.writeFileSync(packageJsonPath, JSON.stringify(updateFn(packageJson), null, 2));
}

function getRepositoryUrl(packageJson) {
    return packageJson.repository?.url || shell.exec('git config --get remote.origin.url').stdout.trim();
}

const prog = sade(CLI_NAME).describe('OpenAPI generator CLI').version(CLI_VERSION);

prog.command('generate <src>')
    .describe('Generate OpenAPI for Angular')
    .option('-o, --output')
    .option('-n, --ng-version')
    .action((src, opts) => {
        const outputDir = opts.o || DEFAULT_OUTPUT_DIR;
        const generatedDir = CLI_NAME;

        console.log('Clean');
        shell.rm('-rf', generatedDir);
        shell.rm('-rf', outputDir);

        console.log('Generate OpenAPI Services');
        const npmRepository = getRepositoryUrl(REPO_PACKAGE_JSON);
        shell.exec(
            [
                `${OPENAPI_GENERATOR_CLI_COMMAND} generate`,
                `-i ${src}`,
                `-g typescript-angular`,
                `-o ${generatedDir}`,
                `-p=${[
                    `useSingleRequestParameter=true`,
                    `npmName=${LIBRARY_NAME}`,
                    `npmVersion=${REPO_PACKAGE_JSON.version}`,
                    `licenseName=${REPO_PACKAGE_JSON.license || DEFAULT_LICENSE}`,
                    `npmRepository=${npmRepository}`,
                ].join(',')}`,
            ].join(' '),
        );

        console.log('Prepare for Publishing');
        shell.cd(generatedDir);
        shell.exec(`npm i`);
        shell.exec(`npm run build`);
        shell.cd('..');
        shell.mv(path.join(generatedDir, 'dist'), outputDir);
        updatePackageJson(path.join(outputDir, 'package.json'), (packageJson) => ({
            ...packageJson,
            peerDependencies: getReplacedDependenciesVersion(packageJson.peerDependencies),
            publishConfig: packageJson.publishConfig || DEFAULT_PUBLISH_CONFIG,
        }));

        console.log('Clean');
        shell.rm('-rf', generatedDir);
    });

prog.parse(process.argv);
