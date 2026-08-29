import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import * as XLSX from "xlsx";
import InventoryAdd from "./InventoryAdd";

jest.mock("axios");

jest.mock("xlsx", () => ({
  read: jest.fn(),
  utils: {
    sheet_to_json: jest.fn(),
  },
}));

jest.mock("../layout/DashboardShell", () => ({
  __esModule: true,
  default: ({ children }) => <div>{children}</div>,
}));

jest.mock("react-router-dom", () => ({
  useNavigate: () => jest.fn(),
}), { virtual: true });

jest.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      role: "accountant",
    },
  }),
}));

describe("InventoryAdd import flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    window.open = jest.fn();
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          asOfDate: "2026-08-14",
          items: {
            goods: [],
            appliance: [],
            monetary: [],
          },
        }),
      })
    );

    axios.get.mockImplementation((url) => {
      if (String(url).includes("/api/inventory/archived")) {
        return Promise.resolve({ data: [] });
      }

      if (String(url).includes("/api/inventory")) {
        return Promise.resolve({ data: [] });
      }

      return Promise.resolve({ data: [] });
    });

    axios.post.mockResolvedValue({ data: { _id: "imported-item-1" } });

    XLSX.read.mockReturnValue({
      SheetNames: ["Sheet1"],
      Sheets: { Sheet1: {} },
    });

    XLSX.utils.sheet_to_json.mockReturnValue([
      {
        "Donor Name": "Sample Donor",
        Amount: 1500,
        "Reference Number": "REF-IMPORT-001",
        "Source Type": "External",
        Notes: "Imported from sample workbook",
      },
    ]);
  });

  test("imports monetary rows with selected proof files and closes the form after success", async () => {
    const { container } = render(<InventoryAdd />);

    fireEvent.click(await screen.findByRole("button", { name: /Add Monetary Donation/i }));

    const documentProof = new File(["proof"], "receipt.pdf", {
      type: "application/pdf",
    });
    const imageProof = new File(["image"], "donation.png", {
      type: "image/png",
    });

    fireEvent.change(screen.getByLabelText(/Validation/i), {
      target: { files: [documentProof, imageProof] },
    });

    const importFile = new File(["sheet"], "inventory-monetary-sample.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    Object.defineProperty(importFile, "arrayBuffer", {
      value: async () => new ArrayBuffer(8),
    });

    const importInput = container.querySelector('input[accept=".xlsx,.xls,.csv"]');
    expect(importInput).not.toBeNull();

    fireEvent.change(importInput, {
      target: { files: [importFile] },
    });

    await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(1));

    const submittedFormData = axios.post.mock.calls[0][1];
    expect(submittedFormData.get("name")).toBe("Sample Donor");
    expect(submittedFormData.get("referenceNumber")).toBe("REF-IMPORT-001");
    expect(submittedFormData.getAll("proofFiles")).toHaveLength(2);

    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: /Donation Details/i })).not.toBeInTheDocument()
    );
  });
});
