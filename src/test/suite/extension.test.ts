import * as assert from "assert";
import { suite, test } from "mocha";
import * as vscode from "vscode";

suite("Extension Test Suite", () => {
    const extensionId = "pentium.mflow-extension";
    vscode.window.showInformationMessage("Start all tests.");

    test("should be present", () => {
        assert.ok(vscode.extensions.getExtension(extensionId));
    });

    test("Should be able to register mflow commands", async () => {
        const commands = await vscode.commands.getCommands(true);
        const MFLOW_COMMANDS = [
            "mflow.show.version",
            "mflow.create.project",
            "mflow.blcks.create",
            "mflow.ansible.create",
            "mflow.shell.create",
            "mflow.build.base",
            "mflow.install.script",
            "mflow.uninstall.script",
            "mflow.up",
            "mflow.down",
            "mflow.run",
            "mflow.logs"
        ];
        const foundArduinoCommands = commands.filter(value => {
            return MFLOW_COMMANDS.indexOf(value) >= 0 || value.startsWith("mflow.");
        });
        const errorMsg = "Some mflow commands are not registered properly or a new command is not added to the test";
        assert.equal(foundArduinoCommands.length, MFLOW_COMMANDS.length, errorMsg);
    });
});
