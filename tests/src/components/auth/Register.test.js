import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import Register from "./Register";

const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}), { virtual: true });

describe("Register", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem("role", "admin");

    global.fetch = jest.fn((url, options) => {
      if (String(url).includes("/api/auth/barangay-options")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            available: ["Calabasa", "Sapang"],
          }),
        });
      }

      if (String(url).includes("/api/auth/register")) {
        return Promise.resolve({
          ok: false,
          json: async () => ({
            error: "USERNAME_EXISTS",
            field: "username",
            message: "Username already exists",
          }),
        });
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });
  });

  test("shows the duplicate username message on the username field when admin registration is rejected", async () => {
    render(<Register />);

    fireEvent.change(screen.getByPlaceholderText(/Enter username/i), {
      target: { value: "takenUser" },
    });
    fireEvent.change(screen.getByPlaceholderText(/name@example.com/i), {
      target: { value: "fresh@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/09XXXXXXXXX/i), {
      target: { value: "09123456789" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Enter full address/i), {
      target: { value: "Jaen, Nueva Ecija" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Create password/i), {
      target: { value: "Strongpass1!" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Re-enter password/i), {
      target: { value: "Strongpass1!" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Create Account/i }));
    const confirmDialog = await screen.findByRole("dialog");
    fireEvent.click(
      confirmDialog.querySelector(".account-modal-btn-primary")
    );

    const usernameField = screen.getByPlaceholderText(/Enter username/i).closest(".form-block");

    await waitFor(() => {
      expect(within(usernameField).getByText("Username already exists")).toBeInTheDocument();
    });
  });
});
