import { Component } from 'react';

/**
 * Catches an error thrown while drawing a page, so one bad value from the API cannot turn the whole site
 * into a blank screen. The header, banner and footer stay; the page body says what happened and how to recover.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    // The browser console is the only place a visitor's failure can be seen; there is no error reporting service.
    console.error('Page failed to draw:', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="wrap section" role="alert">
        <h1>This page could not be shown</h1>
        <p className="measure">
          Something in the data this page uses was not what it expected. The API itself may still be fine: try the{' '}
          <a href="/docs">API reference</a>, or reload the page.
        </p>
        <p>
          <button type="button" className="button" onClick={() => window.location.reload()}>
            Reload
          </button>
        </p>
      </div>
    );
  }
}
