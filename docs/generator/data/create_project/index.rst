  Step 1. 選取 trek 專案存放位置：

      - :Select project location: 點選本機資料夾決定位置。

  Step 2. 決定 trek 專案名稱：

      - :Please enter project name: Trek project name。

  Step 3. 是否建立 trek 提供的範本專案：

      - :Create a sample project: 填入 Y or N，大小寫不拘。若為 Y 表示要建立 trek 提供的範本專案，N 則反之。

建立的專案目錄結構如下：

.. code-block:: shell

    $ tree my.trek.project
    my.trek.project/
    ├── .trek
    │   └── config.json
    ├──inputs
    │   ├── data.yml
    │   └── event.yml
    ├── manifest.json
    ├── packages.json
    └── src
        └── graph.yml