import os
import json

from jinja2 import Environment, BaseLoader
from click import Context
import yaml
import json

# from trek import main


def generate_docs(root_dir):
    # /Users/chelsealo/code/src_code/mflow-extension/docs
    ref_doc_path = os.path.join(root_dir, "reference")
    commands_doc_path = os.path.join(ref_doc_path, "commands")
    os.makedirs(commands_doc_path, exist_ok=True)
    jinja_env = get_jinja_env()
    
    command_names = []
    doc_path = os.path.join(root_dir, "..", "package.json")
    yaml_data = ""
    with open(doc_path, 'r') as file_data:
        yaml_data = file_data.read()
    package_file = yaml.safe_load(yaml_data)
    commands = package_file["contributes"]["commands"]

    for cmd in commands:
        if cmd.get("enablement"):
            continue
        command_names.append(cmd["title"])
    command_names.sort()

    # commands_dic = { i: {"imgs": [os.path.join("..", "_static", "images", "  .")], "desc": ""} for i in command_names}
    # jj = json.dumps(commands_dic, indent=4, separators=(',', ': '))
    # with open(os.path.join(root_dir, "generator", "data", "cmd_img_map.json"), 'w') as f:
    #     f.write(jj);

    # commands.rst
    render_data = {"commands": command_names}
    build_from_template(
        jinja_env,
        "commands.tmp",
        os.path.join(ref_doc_path, "commands.rst"),
        render_data,
    )

    map_path = os.path.join(root_dir, "generator", "data", "cmd_img_map.json")
    json_data = ""
    with open(map_path, 'r') as file_data:
        json_data = file_data.read()
    map_file = yaml.safe_load(json_data)

    # commands in reference
    for cmd in command_names:
        filepath = os.path.join(commands_doc_path, f"{cmd}.rst")
        render_data = {
            "command_name": cmd,
            "command_desc": newline(map_file.get(cmd, {}).get("desc", "")),
            # "doc_string": trim_doc(cmd_obj.callback.__doc__),
        }
        build_from_template(jinja_env, "command_detail.tmp", filepath, render_data)


def to_pretty_json(value):
    return json.dumps(value, sort_keys=True, indent=4, separators=(",", ": "))


def get_jinja_env():
    jinja_env = Environment(
        loader=BaseLoader(),
        extensions=["jinja2.ext.loopcontrols"],
        keep_trailing_newline=True,
    )
    jinja_env.filters["tojson_pretty"] = to_pretty_json
    return jinja_env


def build_from_template(jinja_env, template_filename, target_path, render_data):
    root_dir = os.path.dirname(os.path.abspath(__file__))
    tmp_path = os.path.join(root_dir, "templates", template_filename)
    if not os.path.exists(tmp_path):
        raise Exception(f"No this template: {tmp_path}")

    with open(tmp_path, "r") as tmp_file:
        content = tmp_file.read()
        template = jinja_env.from_string(content)
        render_result = template.render(render_data)

    with open(target_path, "w+") as f:
        f.write(render_result)

def newline(val):
    return val.replace("\n", "\n| ")

def trim_doc(docstring):
    if not docstring:
        return ""

    lines = docstring.expandtabs().splitlines()
    trimmed_lines = []
    count = 0
    for line in lines:
        count += 1
        if count == 1:
            trimmed_lines.append(line)
            continue
        trimmed_lines.append(line[4:])
    return "\n".join(trimmed_lines)


if __name__ == "__main__":
    generate_docs("/Users/chelsealo/code/src_code/mflow-extension/docs")