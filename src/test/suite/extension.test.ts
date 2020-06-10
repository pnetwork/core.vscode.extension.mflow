import assert from "assert";
import { suite, test } from "mocha";
import vscode from "vscode";

async function waitForExtension(ms: number): Promise<NodeJS.Timeout> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
suite("Extension Test Suite", function() {
    this.timeout(10000);
    const extensionId = "pentium.trek-extension";
    vscode.window.showInformationMessage("Start all tests.");

    test("extension running check ", () => {
        assert.ok(vscode.extensions.getExtension(extensionId));
    });

    test("trek commands registration check", async () => {
        vscode.commands.executeCommand("trek.show.version");
        await waitForExtension(3000);
        const commands = await vscode.commands.getCommands(true);
        const TREK_COMMANDS = [
            "trek.show.version",
            "trek.create.project",
            "trek.blcks.create",
            "trek.ansible.create",
            "trek.shell.create",
            "trek.terraform.create",
            "trek.show.installed",
            "trek.install.script",
            "trek.uninstall.script",
            "trek.remote.scripts",
            "trek.view.wf",
            "trek.up",
            "trek.run",
            "trek.ansible.run",
            "trek.shell.run",
            "trek.terraform.run",
            "trek.blcks.run",
            "trek.down",
            "trek.build",
            "trek.blcks.build",
            "trek.show.logs",
            "trek.pack",
            "trek.ansible.pack",
            "trek.shell.pack",
            "trek.terraform.pack",
            "trek.blcks.pack",
            "trek.deploy.auto",
            "trek.ansible.deploy.auto",
            "trek.shell.deploy.auto",
            "trek.terraform.deploy.auto",
            "trek.blcks.deploy.auto",
            "trek.deploy",
            "trek.ansible.deploy",
            "trek.shell.deploy",
            "trek.terraform.deploy",
            "trek.blcks.deploy",
            "trek.login"
        ];
        const foundTrekCommands = commands.filter(value => {
            return TREK_COMMANDS.indexOf(value) >= 0 || value.startsWith("trek.");
        });
        const errorMsg = "Some trek commands are not registered properly or a new command is not added to the test";
        assert.equal(foundTrekCommands.length, TREK_COMMANDS.length, errorMsg);
    });
});
