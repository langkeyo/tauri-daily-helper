# 日报助手

一个基于Tauri构建的跨平台日报管理工具，帮助您高效管理和生成日报、周报和月报。

## 功能特性

- 日报创建和管理
- 周报自动生成
- 月报汇总
- Excel模板导入导出
- 多平台支持：Windows、macOS和Linux

## 开发环境配置

### 前提条件

- Node.js 18+
- Rust 1.77.2+
- 对应平台的开发依赖

### 安装依赖

```bash
# 安装前端依赖
npm install

# 开发环境运行
npm run tauri dev
```

### 打包应用

项目支持通过GitHub Actions自动构建所有平台的安装包。您也可以在本地构建：

```bash
# 构建当前平台的应用
npm run tauri build

# MacOS上构建通用二进制文件(同时支持Intel和Apple Silicon)
npm run tauri build -- --target universal-apple-darwin
```

## 平台支持说明

- **Windows**: 生成`.msi`和`.exe`安装包，适用于Windows 10以上系统
- **macOS**: 生成`.dmg`安装包，同时支持Intel(x64)和Apple Silicon(M1/M2)芯片
- **Linux**: 生成`.AppImage`和`.deb`安装包

注意: Tauri不支持跨平台编译，每个平台的安装包必须在对应的操作系统上构建，或通过CI/CD服务完成。

## 使用GitHub Actions发布

本项目配置了GitHub Actions工作流，可以自动构建所有平台的安装包：

1. 修改版本号：更新`src-tauri/tauri.conf.json`中的`version`字段
2. 创建发布标签：`git tag v0.1.0`并推送到GitHub
3. GitHub Actions将自动构建所有平台的安装包并创建发布草稿
4. 所有平台的安装包会自动发布到主仓库的Releases页面
5. 同时，会自动将安装包复制到[分发仓库](https://github.com/langkeyo/tauri-daily-helper-releases)中

### 获取macOS安装包

即使在Windows环境下开发，您也可以通过以下方式获取macOS安装包：

1. 完成上述发布流程后，等待GitHub Actions完成构建（约10-20分钟）
2. 前往[分发仓库](https://github.com/langkeyo/tauri-daily-helper-releases)的`macos`目录
3. 下载最新的`.dmg`安装包文件

## 许可证

[MIT 许可证](LICENSE)
