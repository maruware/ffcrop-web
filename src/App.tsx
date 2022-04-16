import { GeistProvider, CssBaseline } from "@geist-ui/react";

import { Crop } from "./Crop";

function App() {
  return (
    <GeistProvider>
      <CssBaseline />
      <Crop />
    </GeistProvider>
  );
}

export default App;
