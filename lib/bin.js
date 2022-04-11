#!/usr/bin/env node

const shell = require('shelljs');
const sade = require('sade');
const path = require('path');
const fs = require('fs');

const PACKAGE_JSON = require('../package.json');
const CLI_NAME = Object.keys(PACKAGE_JSON.bin)[0];

const prog = sade(CLI_NAME).describe('OpenAPI generator CLI').version(PACKAGE_JSON.version);

prog.command('generate <src>')
    .describe('Generate OpenAPI for Angular')
    .option('-o, --output')
    .option('-n, --ng-version')
    .action((src, opts) => {
        const angularVersion = opts.n || '~13.0.0';
        const openapiGeneratorCliVersion = opts.n || '~2.4.0';
        const outputDir = opts.o || 'lib';

        const ngCommand = `npm_config_yes=true npx -p @angular/cli@${angularVersion} ng`;
        const openapiGeneratorCliCommand = `npx @openapitools/openapi-generator-cli@${openapiGeneratorCliVersion}`;
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
                'src/lib'
            )} -p=useSingleRequestParameter=true`
        );
        shell.cd(generatedDir);
        shell.exec(`npm run build`);
        shell.cd('..');
        shell.mv(path.join(generatedDir, 'dist', libraryName.replace('@', '')), outputDir);
        let resultPackageJson = require(path.join(process.cwd(), outputDir, 'package.json'));
        resultPackageJson = {
            ...resultPackageJson,
            version: packageJson.version || resultPackageJson.version,
            license: packageJson.license || 'MIT',
            publishConfig: packageJson.publishConfig || {
                access: 'public',
                registry: 'https://registry.npmjs.org/',
            },
        };
        fs.writeFileSync(path.join(outputDir, 'package.json'), JSON.stringify(resultPackageJson, null, 2));
        shell.rm('-rf', generatedDir);
    });

prog.parse(process.argv);
