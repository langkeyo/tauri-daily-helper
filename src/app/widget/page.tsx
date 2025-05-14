"use client"

import { useState, useEffect } from "react"

// 定义小部件组件
export default function WidgetPage() {
  const [time, setTime] = useState(new Date())
  const [todayTasks, setTodayTasks] = useState<number>(0)
  const [completedTasks, setCompletedTasks] = useState<number>(0)
  const [expanded, setExpanded] = useState(false)

  // 更新时间
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  // 模拟获取任务数据
  useEffect(() => {
    // 这里可以实际调用你的API获取今日任务和已完成任务
    // 这里只是模拟随机数
    setTodayTasks(Math.floor(Math.random() * 10) + 1)
    setCompletedTasks(Math.floor(Math.random() * 5))
  }, [])

  // 格式化时间
  const formatTime = (date: Date) => {
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    const seconds = date.getSeconds().toString().padStart(2, '0')
    return `${hours}:${minutes}:${seconds}`
  }

  // 切换展开状态
  const toggleExpand = async () => {
    try {
      // 动态导入Tauri API，避免在SSR环境中报错
      const tauriApi = await import('@tauri-apps/api')

      // 调用Rust后端命令调整窗口大小
      if (!expanded) {
        // 扩大窗口
        await tauriApi.invoke('toggle_widget_size', { width: 400, height: 500 })
      } else {
        // 恢复小窗口大小
        await tauriApi.invoke('toggle_widget_size', { width: 200, height: 200 })
      }

      // 无论命令是否成功，都切换状态以改变UI布局
      setExpanded(!expanded)
    } catch (error) {
      console.error("调整窗口大小失败:", error)
      // 如果调整失败，仍然切换状态以改变UI布局
      setExpanded(!expanded)
    }
  }

  return (
    <div className="widget-container" data-tauri-drag-region>
      <div className={`widget-content ${expanded ? 'expanded' : ''}`}>
        <div className="widget-header">
          <div className="time-display">
            {formatTime(time)}
          </div>
          <div className="date-display">
            {time.toLocaleDateString('zh-CN', { weekday: 'short', month: 'short', day: 'numeric' })}
          </div>
          <button
            className="expand-toggle"
            onClick={toggleExpand}
            title={expanded ? "收起" : "展开"}
          >
            {expanded ? '↓' : '↑'}
          </button>
        </div>

        {!expanded && (
          <div className="expand-hint">
            点击右上角 ↑ 按钮放大
          </div>
        )}

        <div className="task-info">
          <div className="task-count">
            <span>今日任务: {todayTasks}</span>
            <span>已完成: {completedTasks}</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${todayTasks > 0 ? (completedTasks / todayTasks * 100) : 0}%`
              }}
            ></div>
          </div>
        </div>

        {expanded && (
          <div className="expanded-content">
            <div className="report-section">
              <h3>日报摘要</h3>
              <div className="report-list">
                <div className="report-item">
                  <span className="report-title">待办任务</span>
                  <ul>
                    <li>完成日报挂件功能开发</li>
                    <li>数据同步功能测试</li>
                    <li>UI设计评审</li>
                  </ul>
                </div>
                <div className="report-item">
                  <span className="report-title">已完成任务</span>
                  <ul>
                    <li>系统托盘功能实现</li>
                    <li>小部件基础框架搭建</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .widget-container {
          width: 100%;
          height: 100vh;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          flex-direction: column;
          justify-content: ${expanded ? 'flex-start' : 'center'};
          align-items: center;
          color: white;
          padding: 15px;
          font-family: 'Arial', sans-serif;
          user-select: none;
          border-radius: 15px;
          overflow: hidden;
          cursor: move; /* 显示移动光标提示可拖动 */
        }

        .widget-content {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: ${expanded ? 'flex-start' : 'space-between'};
          align-items: center;
          padding: 20px;
          transition: all 0.3s ease;
        }

        .widget-header {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
        }

        .expand-toggle {
          position: absolute;
          right: 5px;
          top: 5px;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: rgba(59, 130, 246, 0.8);
          border: none;
          color: white;
          font-size: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          -webkit-app-region: no-drag; /* 让按钮可点击 */
          transition: background 0.3s;
          z-index: 100;
          box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
        }

        .expand-toggle:hover {
          background: rgba(59, 130, 246, 1);
          transform: scale(1.1);
        }

        .expand-hint {
          position: absolute;
          top: 40px;
          right: 10px;
          background: rgba(59, 130, 246, 0.8);
          padding: 5px 10px;
          border-radius: 4px;
          font-size: 12px;
          animation: pulse 2s infinite;
          pointer-events: none;
        }

        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }

        .time-display {
          font-size: 2.5rem;
          font-weight: bold;
          text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
        }

        .date-display {
          font-size: 1rem;
          margin-top: -5px;
          color: rgba(255, 255, 255, 0.8);
        }

        .task-info {
          width: 100%;
          margin-top: 10px;
        }

        .task-count {
          display: flex;
          justify-content: space-between;
          font-size: 0.8rem;
          margin-bottom: 5px;
        }

        .progress-bar {
          width: 100%;
          height: 4px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 2px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(to right, #4ade80, #3b82f6);
          border-radius: 2px;
          transition: width 0.5s ease;
        }

        .expanded-content {
          width: 100%;
          margin-top: 20px;
          overflow-y: auto;
          -webkit-app-region: no-drag; /* 可滚动区域不应该拖动窗口 */
        }

        .report-section {
          width: 100%;
        }

        .report-section h3 {
          font-size: 1rem;
          margin-bottom: 10px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.2);
          padding-bottom: 5px;
        }

        .report-list {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .report-item {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 10px;
        }

        .report-title {
          font-size: 0.9rem;
          font-weight: bold;
          margin-bottom: 5px;
          display: block;
        }

        .report-item ul {
          margin: 5px 0 0 0;
          padding-left: 20px;
          font-size: 0.8rem;
          color: rgba(255, 255, 255, 0.9);
        }

        .report-item li {
          margin-bottom: 3px;
        }
      `}</style>
    </div>
  )
} 