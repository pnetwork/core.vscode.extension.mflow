import * as assert from "assert";
import { suite, test } from "mocha";
import * as vscode from "vscode";

async function waitForExtension(ms: number): Promise<NodeJS.Timeout> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
suite("Extension Test Suite", function() {
    this.timeout(10000);
    const extensionId = "pentium.mflow-extension";
    vscode.window.showInformationMessage("Start all tests.");

    test("extension running check ", () => {
        assert.ok(vscode.extensions.getExtension(extensionId));
    });

    test("mflow commands registration check", async () => {
        vscode.commands.executeCommand("mflow.show.version");
        await waitForExtension(3000);
        const commands = await vscode.commands.getCommands(true);
        const MFLOW_COMMANDS = [
            "mflow.show.version",
            "mflow.create.project",
            "mflow.blcks.create",
            "mflow.ansible.create",
            "mflow.shell.create",
            "mflow.install.script",
            "mflow.uninstall.script",
            "mflow.up",
            "mflow.run",
            "mflow.down",
            "mflow.logs",
            "mflow.pack",
            "mflow.deploy"
        ];
        const foundArduinoCommands = commands.filter(value => {
            return MFLOW_COMMANDS.indexOf(value) >= 0 || value.startsWith("mflow.");
        });
        const errorMsg = "Some mflow commands are not registered properly or a new command is not added to the test";
        assert.equal(foundArduinoCommands.length, MFLOW_COMMANDS.length, errorMsg);
    });
});
