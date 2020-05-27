若在 workflow 專案下執行命令時：

  Step 1. 決定 Ansible 專案名稱：

      - :Please enter script name: Ansible project name。命名規則需為英數字。

  Step 2. 是否在新視窗開啟 Ansible 專案 ?：

      - :Open blcks project in new window: 填入 Y or N，大小寫不拘。若為 Y 表示要以此腳本為 workspce 開啟新視窗，N 則反之。

若在非 workflow 專案下執行命令時如下說明，執行完全直接以此腳本為 workspce 開啟：
  
  Step 1. 選取 Ansible 專案存放位置：

      - :Select project location: 點選本機資料夾決定位置。

  Step 2. 決定 Ansible 專案名稱：

      - :Please enter script name: Ansible project name。命名規則需為英數字。


建立的專案目錄結構如下：

.. code-block:: shell

    $ tree myansibleproject
    myansibleproject/
    ├── .trek
    │   └── config.json
    ├── an.para
    ├── an.yml
    └── inputs
        └── event.yml