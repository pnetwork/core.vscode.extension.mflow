/* eslint-disable @typescript-eslint/no-unused-vars */
import assert from "assert";
import { suite, test, setup } from "mocha";
import vscode from "vscode";
import { ScriptAutoComplete, EventAutoComplete } from "../../autoComplete";
import yaml from "js-yaml";
import os from "os";
import path from "path";
import fs from "fs";

async function waitForExtension(ms: number): Promise<NodeJS.Timeout> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function filterLabels(result: vscode.CompletionItem[], mustHaveOptions: string[]): string[] {
    const options = result.map(({ label }) => label);
    return options.filter(value => mustHaveOptions.indexOf(value) >= 0);
}

const mockBasePath = "../../../src/test/mock_data";

suite("mflow: Auto Complete Test", function() {
    setup(function(done) {
        this.timeout(10000);
        vscode.workspace.findFiles = async function(
            include: vscode.GlobPattern,
            exclude?: vscode.GlobPattern | null,
            maxResults?: number,
            token?: vscode.CancellationToken
        ): Promise<vscode.Uri[]> {
            const srcPath = path.join(__dirname, `${mockBasePath}/balances.para`);
            const u = vscode.Uri.parse(srcPath);

            return [u];
        };
        done();
    });

    test("script auto complete check", async function() {
        const srcPath = path.join(__dirname, `${mockBasePath}/graph.yml`);
        const wfYaml = yaml.safeLoad(fs.readFileSync(srcPath, "utf8"));
        const autoComplete = new ScriptAutoComplete(os.homedir(), wfYaml, "");
        let result = await autoComplete.getCompletionItems("3", []);
        assert.equal(result.length, 5);
        let mustHaveOptions = ["balances_result", "count", "accounts", "exception", "result"];
        let foundOptions = filterLabels(result, mustHaveOptions);
        assert.equal(foundOptions.length, mustHaveOptions.length);

        result = await autoComplete.getCompletionItems("3", ["accounts"]);
        assert.equal(result.length, 0);

        result = await autoComplete.getCompletionItems("3", ["accounts", "0"]);
        assert.equal(result.length, 3);

        mustHaveOptions = ["name", "account", "balances"];
        foundOptions = filterLabels(result, mustHaveOptions);
        assert.equal(foundOptions.length, mustHaveOptions.length);

        result = await autoComplete.getCompletionItems("3", ["result", "expired_count"]);
        assert.equal(result.length, 0);

        result = await autoComplete.getCompletionItems("3", ["result", "all_domain_ids", "0"]);
        assert.equal(result.length, 0);

        result = await autoComplete.getCompletionItems("3", ["result", "nono"]);
        assert.equal(result.length, 0);
    });
    test("event yaml auto complete check", async function() {
        const srcPath = path.join(__dirname, `${mockBasePath}/graph.yml`);
        const eventYamlPath = path.join(__dirname, `${mockBasePath}/event.yml`);
        const wfYaml = yaml.safeLoad(fs.readFileSync(srcPath, "utf8"));
        const autoComplete = new EventAutoComplete(os.homedir(), wfYaml, "");

        // eslint-disable-next-line @typescript-eslint/camelcase
        autoComplete.config.input_event_path = eventYamlPath.replace(os.homedir(), "");
        let result = await autoComplete.getCompletionItems("0", []);
        assert.equal(result.length, 4);

        let mustHaveOptions = ["name", "inputParamsStr", "eventType", "reservation"];
        let foundOptions = filterLabels(result, mustHaveOptions);
        assert.equal(foundOptions.length, mustHaveOptions.length);

        result = await autoComplete.getCompletionItems("0", ["reservation"]);
        assert.equal(result.length, 1);
        assert.equal(result[0].label, "after");

        result = await autoComplete.getCompletionItems("0", ["reservation", "after", "roles", "0"]);
        assert.equal(result.length, 4);
        mustHaveOptions = ["users", "name", "updatedBy", "id"];
        foundOptions = filterLabels(result, mustHaveOptions);
        assert.equal(foundOptions.length, mustHaveOptions.length);

        result = await autoComplete.getCompletionItems("0", ["reservation", "after", "roles", "0", "updatedBy"]);
        assert.equal(result.length, 2);
        mustHaveOptions = ["id", "name"];
        foundOptions = filterLabels(result, mustHaveOptions);
        assert.equal(foundOptions.length, mustHaveOptions.length);

        result = await autoComplete.getCompletionItems("0", ["reservation", "nono"]);
        assert.equal(result.length, 0);
    });

    test("event json auto complete check", async function() {
        const srcPath = path.join(__dirname, `${mockBasePath}/graph.yml`);
        const eventYamlPath = path.join(__dirname, `${mockBasePath}/event.json`);
        const wfYaml = yaml.safeLoad(fs.readFileSync(srcPath, "utf8"));
        const autoComplete = new EventAutoComplete(os.homedir(), wfYaml, "");

        // eslint-disable-next-line @typescript-eslint/camelcase
        autoComplete.config.input_event_path = eventYamlPath.replace(os.homedir(), "");
        let result = await autoComplete.getCompletionItems("0", []);
        assert.equal(result.length, 4);

        let mustHaveOptions = ["name", "inputParamsStr", "eventType", "reservation"];
        let foundOptions = filterLabels(result, mustHaveOptions);
        assert.equal(foundOptions.length, mustHaveOptions.length);

        result = await autoComplete.getCompletionItems("0", ["reservation"]);
        assert.equal(result.length, 1);
        assert.equal(result[0].label, "after");

        result = await autoComplete.getCompletionItems("0", ["reservation", "after", "roles", "0"]);
        assert.equal(result.length, 4);
        mustHaveOptions = ["users", "name", "updatedBy", "id"];
        foundOptions = filterLabels(result, mustHaveOptions);
        assert.equal(foundOptions.length, mustHaveOptions.length);

        result = await autoComplete.getCompletionItems("0", ["reservation", "after", "roles", "0", "updatedBy"]);
        assert.equal(result.length, 2);
        mustHaveOptions = ["id", "name"];
        foundOptions = filterLabels(result, mustHaveOptions);
        assert.equal(foundOptions.length, mustHaveOptions.length);

        result = await autoComplete.getCompletionItems("0", ["reservation", "nono"]);
        assert.equal(result.length, 0);
    });
});
