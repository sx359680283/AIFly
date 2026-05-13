# 机械拆装仿真

基于 Vite、Three.js、OrbitControls 和 GLTFLoader 的机械拆装仿真原型。

## 运行

```bash
npm install
npm run dev
```

默认访问地址：

```text
http://127.0.0.1:5173
```

## 模型来源

当前主体模型加载自 `public` 目录中的 Hawk 209 IDN glTF 资源：

```text
public/hawk_209_idn/scene.gltf
```

该目录还需要保留 `scene.bin` 和 `textures/`，它们由 `scene.gltf` 通过相对路径引用。

## 当前功能

- 加载 `public/hawk_209_idn` 中的 Hawk 209 IDN 高质量 glTF 模型。
- 只使用加载的 Hawk 209 IDN 模型本体，不再添加额外方块夹具或训练台。
- 按模型内部 mesh 的空间位置生成拆解分组和爆炸视图。
- 支持拆解进度、爆炸视图、播放/暂停、上一步/下一步。
- 支持鼠标旋转、缩放、点击对象查看名称。
- 当前工序会更新说明和操作提示。
