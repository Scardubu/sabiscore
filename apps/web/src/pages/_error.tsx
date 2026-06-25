import type { NextPageContext } from 'next';

interface ErrorProps {
  statusCode: number;
}

function Error({ statusCode }: ErrorProps) {
  return (
    <div style={{ fontFamily: 'sans-serif', textAlign: 'center', padding: '2rem' }}>
      <h1>{statusCode}</h1>
      <p>{statusCode === 404 ? 'Page not found' : 'An error occurred'}</p>
    </div>
  );
}

// getInitialProps prevents static pre-rendering of this page
Error.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

export default Error;
