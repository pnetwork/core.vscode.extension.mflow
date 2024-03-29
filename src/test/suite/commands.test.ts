import assert from "assert";
import { suite, test, setup } from "mocha";
import vscode from "vscode";
import { ScriptAutoComplete, EventAutoComplete } from "../../autoComplete";
import yaml from "js-yaml";
import os from "os";
import path from "path";
import fs from "fs";
import sinon from "sinon";

function filterLabels(result: vscode.CompletionItem[], mustHaveOptions: string[]): string[] {
    const options = result.map(({ label }) => label);
    return options.filter(value => mustHaveOptions.indexOf(value) >= 0);
}

const mockBasePath = "../../../src/test/mock_data";

suite("trek: Auto Complete Test", function() {
    let ouputChannel: vscode.OutputChannel;
    setup(function(done) {
        this.timeout(10000);
        ouputChannel = vscode.window.createOutputChannel("Trek Ouput");
        done();
    });

    const eventYamlPath = path.join(__dirname, `${mockBasePath}/event.yml`);
    const util = require("../../util");
    sinon.stub(util, "getConfigProperty").returns(eventYamlPath.replace(os.homedir(), ""));

    test("script auto complete check", async function() {
        const srcPath = path.join(__dirname, `${mockBasePath}/graph.yml`);
        const wfYaml = yaml.safeLoad(fs.readFileSync(srcPath, "utf8"));
        const mockScript = [
            {
                scriptId: "balances",
                scriptType: "blcks",
                scriptPath: "/xxx/blcks.python.account.balances/handler",
                scriptSchemaPath: path.join(__dirname, mockBasePath, "balances.para")
            }
        ];
        const autoComplete = new ScriptAutoComplete(os.homedir(), wfYaml, mockScript, ouputChannel);
        // let result = await autoComplete.getCompletionItems("3", []);
        // assert.equal(result.length, 5);
        let mustHaveOptions = ["balances_result", "count", "accounts", "exception", "result"];
        // let foundOptions = filterLabels(result, mustHaveOptions);
        // assert.equal(foundOptions.length, mustHaveOptions.length);

        // result = await autoComplete.getCompletionItems("3", ["accounts"]);
        // assert.equal(result.length, 0);

        let result = await autoComplete.getCompletionItems("3", ["accounts", "0"]);
        assert.equal(result.length, 3);

        mustHaveOptions = ["name", "account", "balances"];
        const foundOptions = filterLabels(result, mustHaveOptions);
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
        const wfYaml = yaml.safeLoad(fs.readFileSync(srcPath, "utf8"));
        const autoComplete = new EventAutoComplete(os.homedir(), wfYaml, ouputChannel);
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
        const wfYaml = yaml.safeLoad(fs.readFileSync(srcPath, "utf8"));
        const autoComplete = new EventAutoComplete(os.homedir(), wfYaml, ouputChannel);

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
