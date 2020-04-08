import { TextDocument, Position } from "vscode";
import axios from "axios";
import child from "child_process";
import yaml from "js-yaml";
import path from "path";

export function getTextbyRegex(
    document: TextDocument,
    position: Position,
    matchRegex: { [Symbol.match](string: string): RegExpMatchArray | null },
    endwithPosition = false
): RegExpMatchArray | null | undefined {
    const line = endwithPosition
        ? document.lineAt(position).text.substring(0, position.character)
        : document.lineAt(position).text;
    const lineText = line.match(matchRegex);
    if (lineText && lineText.length > 1) {
        return lineText;
    }
}

export function getScriptbyRegex(
    wfScript: any,
    document: TextDocument,
    position: Position,
    matchRegex: { [Symbol.match](string: string): RegExpMatchArray | null },
    endwithPosition = false
): any[] | undefined {
    const lineText = getTextbyRegex(document, position, matchRegex, endwithPosition);
    if (lineText && lineText.length > 1) {
        const scriptId = document.getText(document.getWordRangeAtPosition(position));
        return wfScript.filter((x: { scriptId: any }) => x.scriptId === scriptId);
    }
}

function getMflowConfig(mflowPath: string, cwdPath: string, commandOptions: string[]): any {
    const configStr = child.execFileSync(`${mflowPath}`, commandOptions, {
        cwd: cwdPath
    });
    return yaml.safeLoad(configStr.toString());
}

/**
 * Assets type.
 * When change assets type please modify commands in pakages.json also.
 * uri: get api path.
 * name: command name.
 */
export const AssetsType = {
    HOST: { uri: "hosts", name: "host" },
    DOMAIN: { uri: "domains", name: "domain" },
    CHATBOT: { uri: "ims/chatbot-channels", name: "chatbot" }
};

async function getProvidersList(marvinUrl: string, marvinJWT: string): Promise<Map<string, string>> {
    const items = new Map();
    const apiPath = "clouds/providers/list";
    const wfurl = marvinUrl.endsWith("/")
        ? marvinUrl + path.join("api", apiPath)
        : marvinUrl + "/" + path.join("api", apiPath);
    const result = await axios.get(wfurl, {
        responseType: "json",
        headers: {
            "Content-Type": "application/json",
            Authorization: marvinJWT
        }
    });
    if (result.data && result.data.data) {
        result.data.data.forEach((i: any) => {
            items.set(i.id, i.name);
        });
    }
    return items;
}

export async function getAssets(mflowPath: string, cwdPath: string, assetPath: { uri: string }): Promise<any[]> {
    let marvinUrl: string, marvinJWT: string;
    let scripts = getMflowConfig(mflowPath, cwdPath, ["config", "-l"]);
    marvinUrl = scripts.marvin_url;
    marvinJWT = scripts.marvin_JWT;
    if (!marvinUrl || !marvinUrl) {
        scripts = getMflowConfig(mflowPath, cwdPath, ["config", "--global", "-l"]);
        marvinUrl = scripts.marvin_url;
        marvinJWT = scripts.marvin_JWT;
    }
    if (!marvinUrl || !marvinUrl) return [];

    const items: any[] = [];
    const wfurl = marvinUrl.endsWith("/")
        ? marvinUrl + path.join("api", assetPath.uri)
        : marvinUrl + "/" + path.join("api", assetPath.uri);
    const result = await axios.get(wfurl, {
        responseType: "json",
        headers: {
            "Content-Type": "application/json",
            Authorization: marvinJWT
        }
    });
    if (result.data && result.data.data) {
        if (assetPath === AssetsType.HOST) {
            result.data.data.forEach((i: any) =>
                items.push({
                    label: `${i.cloudProvider.name}: ${i.name}`,
                    detail: i.ip,
                    description: i.description,
                    id: i.id
                })
            );
        } else if (assetPath === AssetsType.DOMAIN) {
            const providerMap = await getProvidersList(marvinUrl, marvinJWT);
            let r: string, s: string;
            result.data.data.forEach((i: any) => {
                r = providerMap.get(i.registrarId) || "";
                s = providerMap.get(i.resolverId) || "";
                items.push({
                    label: i.name,
                    detail: `Registrar: ${r}  Resolver: ${s}`,
                    description: i.description,
                    id: i.id
                });
            });
        } else if (assetPath === AssetsType.CHATBOT) {
            result.data.data.forEach((i: any) =>
                items.push({
                    label: `${i.provider.name}: ${i.name}`,
                    detail: i.imBotName,
                    description: i.description,
                    id: i.id
                })
            );
        }
    }
    return items;
}
