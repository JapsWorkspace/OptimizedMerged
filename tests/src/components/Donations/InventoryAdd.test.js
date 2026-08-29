import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import InventoryAdd from "./InventoryAdd";

jest.mock("axios");

jest.mock("xlsx", () => ({}));

jest.mock("../layout/DashboardShell", () => ({
  __esModule: true,
  default: ({ children }) => <div>{children}</div>,
}));

const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}), { virtual: true });

jest.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      role: "admin",
    },
  }),
}));

describe("InventoryAdd history view", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    window.open = jest.fn();
    axios.post.mockResolvedValue({ data: {} });

    global.fetch = jest.fn((url) => {
      if (String(url).includes("/api/inventory/history?")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            asOfDate: "2026-07-31",
            items: {
              goods: [],
              appliance: [],
              monetary: [
                {
                  _id: "history-monetary-1",
                  type: "monetary",
                  name: "July Snapshot Donor",
                  amount: 2500,
                  addedBy: "Admin User",
                  createdAt: "2026-07-10T08:00:00.000Z",
                },
              ],
            },
          }),
        });
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    axios.get.mockImplementation((url) => {
      if (String(url).includes("/api/inventory/archived")) {
        return Promise.resolve({ data: [] });
      }

      if (String(url).includes("/api/inventory")) {
        return Promise.resolve({
          data: [
            {
              _id: "live-monetary-1",
              type: "monetary",
              name: "Live Donor",
              amount: 4000,
              referenceNumber: "1234567890",
              addedBy: "Admin User",
              createdAt: "2026-08-14T09:00:00.000Z",
            },
          ],
        });
      }

      return Promise.resolve({ data: [] });
    });
  });

  test("uses a capped date-only history picker and can return to live mode", async () => {
    const { container } = render(<InventoryAdd />);

    expect(await screen.findByText("History")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Monetary Donations/i }));

    const historyDateInput = container.querySelector(".inventory-history-date");
    expect(historyDateInput).not.toBeNull();
    expect(historyDateInput).toHaveAttribute("max", "2026-08-23");

    fireEvent.change(historyDateInput, {
      target: { value: "2026-07-31" },
    });
    expect(await screen.findByText(/Viewing inventory as of/i)).toBeInTheDocument();
    expect(await screen.findByText("July Snapshot Donor")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Clear history date/i }));
    expect(screen.queryByText(/Viewing inventory as of/i)).not.toBeInTheDocument();
    expect(await screen.findByText("Live Donor")).toBeInTheDocument();
  });

  test("clear filters resets history on inventory add and returns to live records", async () => {
    const { container } = render(<InventoryAdd />);

    fireEvent.click(await screen.findByRole("button", { name: /Monetary Donations/i }));

    const historyDateInput = container.querySelector(".inventory-history-date");
    expect(historyDateInput).not.toBeNull();

    fireEvent.change(historyDateInput, {
      target: { value: "2026-07-31" },
    });
    expect(await screen.findByText(/Viewing inventory as of/i)).toBeInTheDocument();
    expect(await screen.findByText("July Snapshot Donor")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Clear Filters/i }));

    await waitFor(() =>
      expect(screen.queryByText(/Viewing inventory as of/i)).not.toBeInTheDocument()
    );
    expect(await screen.findByText("Live Donor")).toBeInTheDocument();
  });

  test("shows an inline error when a manual monetary reference number already exists", async () => {
    render(<InventoryAdd />);

    axios.post.mockRejectedValueOnce({
      response: {
        data: {
          message: "Reference number already exists for another monetary donation.",
        },
      },
    });

    fireEvent.click(await screen.findByRole("button", { name: /Monetary Donations/i }));
    fireEvent.click(screen.getByRole("button", { name: /Add Monetary Donation/i }));

    fireEvent.change(screen.getByLabelText(/Donor Name/i), {
      target: { value: "Duplicate Ref Donor" },
    });
    fireEvent.change(screen.getByLabelText(/Amount/i), {
      target: { value: "2500" },
    });
    fireEvent.change(screen.getByLabelText(/Reference Number/i), {
      target: { value: "1234567890" },
    });
    fireEvent.change(screen.getByLabelText(/^Provider/i), {
      target: { value: "external" },
    });
    fireEvent.change(screen.getByLabelText(/Validation/i), {
      target: {
        files: [
          new File(["document proof"], "proof.pdf", { type: "application/pdf" }),
          new File(["image proof"], "proof.png", { type: "image/png" }),
        ],
      },
    });

    fireEvent.click(screen.getByRole("button", { name: /Save Monetary/i }));

    expect(
      await screen.findAllByText(
        "Reference number already exists for another monetary donation."
      )
    ).not.toHaveLength(0);
  });

  test("shows inline validation errors for invalid goods identity fields", async () => {
    render(<InventoryAdd />);

    fireEvent.click(await screen.findByRole("button", { name: /Add Goods Donation/i }));

    fireEvent.change(screen.getByLabelText(/Item Name/i), {
      target: { value: "455555555555555" },
    });
    fireEvent.change(screen.getByLabelText(/Category/i), {
      target: { value: "food" },
    });
    fireEvent.change(screen.getByLabelText(/Quantity/i), {
      target: { value: "80" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: /^Unit/i }), {
      target: { value: "__custom_unit__" },
    });
    fireEvent.change(screen.getByPlaceholderText(/tray, bundle, pair/i), {
      target: { value: "5d9fhh9d" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: /^Provider/i }), {
      target: { value: "donated" },
    });
    fireEvent.change(screen.getByLabelText(/Provider Name/i), {
      target: { value: "&djdj&jlll@" },
    });
    fireEvent.change(screen.getByLabelText(/Validation/i), {
      target: {
        files: [
          new File(["document proof"], "proof.pdf", { type: "application/pdf" }),
          new File(["image proof"], "proof.png", { type: "image/png" }),
        ],
      },
    });

    fireEvent.click(screen.getByRole("button", { name: /Save Goods/i }));

    expect(
      await screen.findByText(
        "Name must use letters only and may include spaces, periods, apostrophes, or hyphens."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Unit must use letters only and may include spaces, periods, apostrophes, or hyphens."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Provider name must use letters only and may include spaces, periods, apostrophes, or hyphens."
      )
    ).toBeInTheDocument();
  });

  test("keeps previously selected proof files when more files are added in separate picks", async () => {
    render(<InventoryAdd />);

    fireEvent.click(await screen.findByRole("button", { name: /Add Goods Donation/i }));

    const proofInput = screen.getByLabelText(/Validation/i);
    const imageProof = new File(["image proof"], "proof-image.png", {
      type: "image/png",
    });
    const documentProof = new File(["document proof"], "proof-document.pdf", {
      type: "application/pdf",
    });

    fireEvent.change(proofInput, {
      target: { files: [imageProof] },
    });
    expect(await screen.findByText(/1 file selected/i)).toBeInTheDocument();

    fireEvent.change(proofInput, {
      target: { files: [documentProof] },
    });

    expect(await screen.findByText(/2 files selected/i)).toBeInTheDocument();
    expect(screen.getByText(/proof-image\.png/i)).toBeInTheDocument();
    expect(screen.getByText(/proof-document\.pdf/i)).toBeInTheDocument();
  });
});
