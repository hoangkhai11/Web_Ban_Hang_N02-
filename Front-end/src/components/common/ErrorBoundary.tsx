import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ErrorState } from './States'

/** Bắt lỗi khi render: hiện thông báo thay vì trang trắng; không đưa chi tiết kỹ thuật ra giao diện. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="container-page py-20">
        <ErrorState message="Trang gặp lỗi không mong muốn. Vui lòng tải lại trang." onRetry={() => window.location.reload()} />
      </div>
    )
  }
}
