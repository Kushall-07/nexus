import { configure } from "@testing-library/react";

// Whole-App renders are slow under jsdom (especially on synced/Windows disks);
// the default 1s findBy*/waitFor budget made correct tests flaky.
configure({ asyncUtilTimeout: 8000 });
