#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const sade = require('sade');
const shell = require('shelljs');

const OPENAPI_GENERATOR_CLI_VERSION = '2';

const DEFAULT_OUTPUT_DIR = 'lib';
const DEFAULT_PUBLISH_CONFIG = {
    access: 'public',
    registry: 'https://registry.npmjs.org/',
};
const DEFAULT_LICENSE = 'Apache-2.0';

const PACKAGE_JSON = require('../package.json');
const CLI_NAME = Object.keys(PACKAGE_JSON.bin)[0];

function getReplacedDependenciesVersion(dependencies, version = '*') {
    return Object.fromEntries((Object.keys(dependencies) || []).map((dep) => [dep, version]));
}

function updatePackageJson(packageJsonPath, updateFn) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return fs.writeFileSync(packageJsonPath, JSON.stringify(updateFn(packageJson), null, 2));
}

const prog = sade(CLI_NAME).describe('OpenAPI generator CLI').version(PACKAGE_JSON.version);

prog.command('generate <src>')
    .describe('Generate OpenAPI for Angular')
    .option('-o, --output')
    .option('-n, --ng-version')
    .action((src, opts) => {
        const outputDir = opts.o || DEFAULT_OUTPUT_DIR;

        const openapiGeneratorCliCommand = `npm_config_yes=true npx @openapitools/openapi-generator-cli@${OPENAPI_GENERATOR_CLI_VERSION}`;
        const generatedDir = CLI_NAME;
        const packageJson = require(path.join(process.cwd(), 'package.json'));
        const libraryName = packageJson.name;

        console.log('Clean');
        shell.rm('-rf', generatedDir);
        shell.rm('-rf', outputDir);

        console.log('Generate OpenAPI Services');
        let npmRepository =
            packageJson.repository?.url || shell.exec('git config --get remote.origin.url').stdout.trim();
        shell.exec(
            [
                `${openapiGeneratorCliCommand} generate`,
                `-i ${src}`,
                `-g typescript-angular`,
                `-o ${generatedDir}`,
                `-p=${[
                    `useSingleRequestParameter=true`,
                    `npmName=${libraryName}`,
                    `npmVersion=${packageJson.version}`,
                    `licenseName=${packageJson.license || DEFAULT_LICENSE}`,
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
