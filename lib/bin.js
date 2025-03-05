#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const sade = require('sade');
const shell = require('shelljs');

const DEFAULT_ANGULAR_VERSION = 'latest';
const DEFAULT_OUTPUT_DIR = 'lib';

const PACKAGE_JSON = require('../package.json');
const CLI_NAME = Object.keys(PACKAGE_JSON.bin)[0];

const prog = sade(CLI_NAME).describe('OpenAPI generator CLI').version(PACKAGE_JSON.version);

function createPackageJson(swagPackageJson, projectPackageJson) {
    return {
        ...swagPackageJson,
        version: projectPackageJson.version || swagPackageJson.version,
        license: projectPackageJson.license || 'MIT',
        publishConfig: projectPackageJson.publishConfig || {
            access: 'public',
            registry: 'https://registry.npmjs.org/',
        },
    };
}

prog.command('generate <src>')
    .describe('Generate OpenAPI for Angular')
    .option('-o, --output')
    .option('-n, --ng-version')
    .action((src, opts) => {
        const angularVersion = opts.n || DEFAULT_ANGULAR_VERSION;
        const outputDir = opts.o || DEFAULT_OUTPUT_DIR;

        const ngCommand = `npm_config_yes=true npx -p @angular/cli@${angularVersion} ng`;
        const openapiGeneratorCliCommand = `npx @openapitools/openapi-generator-cli`;
        const generatedDir = CLI_NAME;
        const packageJson = require(path.join(process.cwd(), 'package.json'));
        const libraryName = packageJson.name;
        const libraryPath = path.join(generatedDir, 'projects', libraryName.replace('@', ''));

        shell.rm('-rf', generatedDir);
        shell.rm('-rf', outputDir);
        shell.exec(`${ngCommand} new ${generatedDir} --no-create-application`);
        shell.cd(generatedDir);
        shell.exec(`${ngCommand} generate library ${libraryName}`);
        shell.cd(`..`);
        shell.rm('-rf', path.join(libraryPath, 'src/lib'));
        fs.writeFileSync(path.join(libraryPath, 'src/public-api.ts'), 'export * from "./lib";');
        shell.exec(
            `${openapiGeneratorCliCommand} generate -i ${src} -g typescript-angular -o ${path.join(
                libraryPath,
                'src/lib',
            )} -p=useSingleRequestParameter=true`,
        );
        shell.cd(generatedDir);
        shell.exec(`npm run build`);
        shell.cd('..');
        shell.mv(path.join(generatedDir, 'dist', libraryName.replace('@', '')), outputDir);
        const swagPackageJson = createPackageJson(
            require(path.join(process.cwd(), outputDir, 'package.json')),
            packageJson,
        );
        fs.writeFileSync(path.join(outputDir, 'package.json'), JSON.stringify(swagPackageJson, null, 2));
        shell.rm('-rf', generatedDir);
    });

prog.parse(process.argv);
