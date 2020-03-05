import { window, Uri } from "vscode";
import { MultiStepInput, InputStep } from "./basicMultiStepInput";
import { createBrowseFolder } from "./basicInput";
import { ScriptTypes, PackTypes, MFlowCommand } from "./commands";
// import { stat } from "fs";

/**
 * Multiple step types.
 */
export enum MultiStepTypes {
    CREATE_PROJECT,
    DEPLOY
}

interface StepResult {
    isSuc: boolean;
    title: string;
    name: string;
    uri: Uri;
    yn: string;
    scriptType: ScriptTypes;
    type: PackTypes;
}

/**
 * A multi-step input using window.createQuickPick() and window.createInputBox().
 * This first part uses the helper class `MultiStepInput` that wraps the API for the multi-step case.
 * @param title: Window title.
 * @param multiStepType: MultiStepTypes.
 * @param mflowCmd: mflow command obj.
 */
export async function multiStepInput(
    title: string,
    multiStepType: MultiStepTypes,
    mflowCmd?: MFlowCommand
): Promise<StepResult> {
    async function askCreateSample(input: MultiStepInput, step: Partial<StepResult>): Promise<void> {
        step.yn = await input.showInputBox({
            title,
            step: 3,
            totalSteps: 3,
            value: step.yn || "",
            prompt: "Create a sample project?",
            placeHolder: "Y/N",
            validate: text => {
                text = text.toUpperCase();
                if (text !== "Y" && text !== "N") return "Input value should be Y or N.";
            }
        });
    }
    async function inputProjectName(input: MultiStepInput, step: Partial<StepResult>): Promise<InputStep> {
        step.name = await input.showInputBox({
            title,
            step: 2,
            totalSteps: 3,
            value: step.name || "",
            prompt: "Please enter project name: "
        });
        return (input: MultiStepInput): Promise<void> => askCreateSample(input, step);
    }
    async function selectLocation(input: MultiStepInput, step: Partial<StepResult>): Promise<InputStep> {
        const items = [{ label: "$(file-directory) Browse...", value: "0", description: "(recently used)" }];
        if (step.uri) items.push({ label: step.uri.fsPath, value: "1", description: "(selected)" });
        const pick = await input.showQuickPick({
            title,
            step: 1,
            totalSteps: 3,
            placeholder: "Select project location",
            items: items,
            activeItem: undefined
        });
        const defaultUri = pick.value === "1" ? Uri.parse(pick.label) : undefined;
        const folderUri = await createBrowseFolder(defaultUri);
        if (!folderUri) {
            return (input: MultiStepInput): Promise<InputStep> => selectLocation(input, step);
        }
        step.uri = folderUri;
        return (input: MultiStepInput): Promise<InputStep> => inputProjectName(input, step);
    }

    async function askOverwrite(input: MultiStepInput, step: Partial<StepResult>): Promise<void> {
        step.yn = await input.showInputBox({
            title,
            step: 3,
            totalSteps: 3,
            value: step.yn || "",
            prompt: "Overwrite existing scripts on Marvin ? ",
            placeHolder: "Y/N",
            validate: text => {
                text = text.toUpperCase();
                if (text !== "Y" && text !== "N") return "Input value should be Y or N.";
            }
        });
    }

    async function selectScript(input: MultiStepInput, step: Partial<StepResult>): Promise<InputStep> {
        const items = mflowCmd?.getScriptQuickPickItems() || [];
        const scriptSelect = await input.showQuickPick({
            title,
            step: 2,
            totalSteps: 3,
            items: items,
            activeItem: undefined
        });

        step.name = scriptSelect.detail;
        step.scriptType = scriptSelect.description;
        return (input: MultiStepInput): Promise<void> => askOverwrite(input, step);
    }

    async function selectTarget(input: MultiStepInput, step: Partial<StepResult>): Promise<InputStep> {
        const items = Object.values(PackTypes).map(label => ({ label }));
        const result = await input.showQuickPick({
            title,
            step: 1,
            totalSteps: 3,
            items: items,
            activeItem: undefined
        });
        step.type = result ? result.label : "";
        if (step.type === PackTypes.SCRIPT) {
            return (input: MultiStepInput): Promise<InputStep> => selectScript(input, step);
        } else {
            return (input: MultiStepInput): Promise<void> => askOverwrite(input, step);
        }
    }

    const result = {} as Partial<StepResult>;
    if (multiStepType === MultiStepTypes.CREATE_PROJECT) {
        await MultiStepInput.run(input => selectLocation(input, result));
        if (result.name && result.uri && result.yn) {
            result.title = title;
            result.isSuc = true;
            window.showInformationMessage(`Creating mflow Project '${result.name}'`);
        } else {
            result.isSuc = false;
        }
    } else if (multiStepType === MultiStepTypes.DEPLOY) {
        await MultiStepInput.run(input => selectTarget(input, result));
        if (result.type && result.yn) {
            result.title = title;
            result.isSuc = true;
            window.showInformationMessage(`Deploy mflow Project`);
        } else {
            result.isSuc = false;
        }
    }
    return result as StepResult;
}
