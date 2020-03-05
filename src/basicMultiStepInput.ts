import { QuickPickItem, window, Disposable, QuickInputButton, QuickInput, QuickInputButtons } from "vscode";

export type InputStep = (input: MultiStepInput) => Promise<InputStep | void>;

class InputFlowAction {
    static back = new InputFlowAction();
    static cancel = new InputFlowAction();
    static resume = new InputFlowAction();
}

interface InputBoxParameters {
    title: string;
    step: number;
    totalSteps: number;
    value: string;
    prompt: string;
    placeHolder?: string;
    validate?: (value: string) => string | undefined;
    buttons?: QuickInputButton[];
}

interface QuickPickParameters<T extends QuickPickItem> {
    title: string;
    step: number;
    totalSteps: number;
    items: T[];
    activeItem?: T;
    placeholder?: string;
    buttons?: QuickInputButton[];
    value?: string;
}

export class MultiStepInput {
    static async run<T>(start: InputStep): Promise<void> {
        const input = new MultiStepInput();
        return input.stepThrough(start);
    }

    private current?: QuickInput;
    private steps: InputStep[] = [];

    private async stepThrough<T>(start: InputStep): Promise<void> {
        let step: InputStep | void = start;
        while (step) {
            this.steps.push(step);
            if (this.current) {
                this.current.enabled = false;
                this.current.busy = true;
            }
            try {
                step = await step(this);
            } catch (err) {
                if (err === InputFlowAction.back) {
                    this.steps.pop();
                    step = this.steps.pop();
                } else if (err === InputFlowAction.resume) {
                    step = this.steps.pop();
                } else if (err === InputFlowAction.cancel) {
                    step = undefined;
                } else {
                    throw err;
                }
            }
        }
        if (this.current) {
            this.current.dispose();
        }
    }

    async showQuickPick<T extends QuickPickItem, P extends QuickPickParameters<T>>({
        title,
        step,
        totalSteps,
        items,
        activeItem,
        placeholder,
        buttons,
        value
    }: P): Promise<any> {
        const disposables: Disposable[] = [];
        try {
            return await new Promise<T | (P extends { buttons: (infer I)[] } ? I : never)>((resolve, reject) => {
                const input = window.createQuickPick<T>();
                input.title = title;
                input.step = step;
                input.totalSteps = totalSteps;
                input.placeholder = placeholder;
                input.items = items;
                if (value) input.value = value;
                if (activeItem) {
                    input.activeItems = [activeItem];
                }
                input.buttons = [...(this.steps.length > 1 ? [QuickInputButtons.Back] : []), ...(buttons || [])];
                disposables.push(
                    input.onDidTriggerButton(item => {
                        if (item === QuickInputButtons.Back) {
                            reject(InputFlowAction.back);
                        } else {
                            resolve(item as any);
                        }
                    }),
                    input.onDidChangeSelection(items => resolve(items[0]))
                );
                if (this.current) {
                    this.current.dispose();
                }
                this.current = input;
                this.current.show();
            });
        } finally {
            disposables.forEach(d => d.dispose());
        }
    }

    async showInputBox<P extends InputBoxParameters>({
        title,
        step,
        totalSteps,
        value,
        prompt,
        placeHolder,
        validate,
        buttons
    }: P): Promise<any> {
        const disposables: Disposable[] = [];
        try {
            return await new Promise<string | (P extends { buttons: (infer I)[] } ? I : never)>((resolve, reject) => {
                const input = window.createInputBox();
                input.title = title;
                input.step = step;
                input.totalSteps = totalSteps;
                input.value = value || "";
                input.prompt = prompt;
                input.placeholder = placeHolder;
                input.buttons = [...(this.steps.length > 1 ? [QuickInputButtons.Back] : []), ...(buttons || [])];
                disposables.push(
                    input.onDidTriggerButton(item => {
                        if (item === QuickInputButtons.Back) {
                            reject(InputFlowAction.back);
                        } else {
                            resolve(item as any);
                        }
                    }),
                    input.onDidAccept(async () => {
                        const value = input.value;
                        input.enabled = false;
                        input.busy = true;
                        if (!validate || !(await validate(value))) {
                            resolve(value);
                        }
                        input.enabled = true;
                        input.busy = false;
                    })
                );

                if (validate) {
                    let validating = validate("");
                    disposables.push(
                        input.onDidChangeValue(async text => {
                            const current = validate(text);
                            validating = current;
                            const validationMessage = current;
                            if (current === validating) {
                                input.validationMessage = validationMessage;
                            }
                        })
                    );
                }
                if (this.current) {
                    this.current.dispose();
                }
                this.current = input;
                this.current.show();
            });
        } finally {
            disposables.forEach(d => d.dispose());
        }
    }
}
