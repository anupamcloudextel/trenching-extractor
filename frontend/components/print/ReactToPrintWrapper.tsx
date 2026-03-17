import React from "react";
import ReactToPrint from "react-to-print";

export function ReactToPrintWrapper(props: any) {
  const PrintComponent = ReactToPrint as any;
  return <PrintComponent {...props} />;
} 