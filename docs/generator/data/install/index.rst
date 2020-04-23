- :Please enter script id:
    | 填入 pattern 為 ``*`` 或 ``{scriptid}=={version}``。
    | 請輸入腳本 id 及版號，以安裝 notification 腳本為例：
    
    - ``*`` : 依 trek project 的 *./packages.json* 檔案中所描述的腳本進行下載。
      
        .. code-block:: shell

            # {your_trek_project_path}/packages.json
            {
                "packages": {
                    "blckssettags": "==0.5.0"
                }
            }

    - ``notification`` : 沒有指定版號代表下載最新版號的腳本。
    - ``notification==0.5.0`` : 下載指定版號 ``0.5.0`` 的腳本。