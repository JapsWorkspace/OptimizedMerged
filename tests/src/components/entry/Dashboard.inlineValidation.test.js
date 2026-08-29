import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Dashboard from "./Dashboard";

jest.mock("../layout/DashboardShell", () => ({
  __esModule: true,
  default: ({ children }) => <div>{children}</div>,
}));

jest.mock(
  "react-router-dom",
  () => ({ useNavigate: () => jest.fn() }),
  { virtual: true }
);

jest.mock("../map/Map", () => () => <div />);

beforeEach(() => {
  localStorage.clear();
  global.IntersectionObserver = class {
    observe() {}
    disconnect() {}
  };
  global.fetch = jest.fn((url, options) => {
    if (String(url).includes("/api/debug-session")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ role: "admin" }),
      });
    }

    if (options?.method === "PUT") {
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: JSON.parse(options.body) }),
      });
    }

    return Promise.resolve({
      ok: true,
      json: async () => ({ data: null }),
    });
  });
});

function renderDashboard() {
  render(<Dashboard />);
}

async function openInlineEditor() {
  await screen.findByRole("button", { name: /Editor Mode/i });
  fireEvent.click(screen.getByRole("button", { name: /Edit Landing/i }));
}

test("removes id-less persisted landing page rows from every editable section", async () => {
  global.fetch.mockImplementation((url, options) => {
    if (String(url).includes("/api/debug-session")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ role: "admin" }),
      });
    }

    if (String(url).includes("/api/public-site") && !options?.method) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: {
            announcements: [
              { title: "Keep update", body: "Keep this update", tag: "News" },
              { title: "Delete update", body: "Delete this update", tag: "News" },
            ],
            tips: [{ text: "Keep tip" }, { text: "Delete tip" }],
            hotlines: [
              { label: "Keep contact", number: "09170000001", type: "call" },
              { label: "Delete contact", number: "09170000002", type: "call" },
            ],
          },
        }),
      });
    }

    return Promise.resolve({
      ok: true,
      json: async () => ({ data: null }),
    });
  });

  renderDashboard();

  await screen.findByText("Delete update");
  await openInlineEditor();

  fireEvent.click(screen.getAllByTitle("Remove announcement")[1]);
  fireEvent.click(screen.getAllByTitle("Remove tip")[1]);
  fireEvent.click(screen.getAllByTitle("Remove contact")[1]);

  await waitFor(() => {
    expect(screen.queryByDisplayValue("Delete update")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("Delete tip")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("Delete contact")).not.toBeInTheDocument();
  });
  expect(screen.getByDisplayValue("Keep update")).toBeInTheDocument();
  expect(screen.getByDisplayValue("Keep tip")).toBeInTheDocument();
  expect(screen.getByDisplayValue("Keep contact")).toBeInTheDocument();
});

test("removes the selected update row from the landing page editor", async () => {
  renderDashboard();

  await openInlineEditor();
  const initialRowCount = screen.getAllByTitle("Remove announcement").length;
  fireEvent.click(screen.getByRole("button", { name: "Add Notice" }));
  await waitFor(() => {
    expect(screen.getAllByTitle("Remove announcement")).toHaveLength(
      initialRowCount + 1
    );
  });
  fireEvent.change(screen.getAllByPlaceholderText(/Announcement title/i).at(-1), {
    target: { value: "Unique Update To Remove" },
  });

  fireEvent.click(screen.getAllByTitle("Remove announcement").at(-1));

  await waitFor(() => {
    expect(screen.getAllByTitle("Remove announcement")).toHaveLength(
      initialRowCount
    );
  });
  expect(screen.queryByDisplayValue("Unique Update To Remove")).not.toBeInTheDocument();
});

test("removes the selected preparedness reminder from the landing page editor", async () => {
  renderDashboard();

  await openInlineEditor();
  const initialRowCount = screen.getAllByTitle("Remove tip").length;
  fireEvent.click(screen.getByRole("button", { name: "Add Tip" }));
  await waitFor(() => {
    expect(screen.getAllByTitle("Remove tip")).toHaveLength(initialRowCount + 1);
  });
  fireEvent.change(screen.getAllByPlaceholderText(/Preparedness reminder/i).at(-1), {
    target: { value: "Unique Reminder To Remove" },
  });

  fireEvent.click(screen.getAllByTitle("Remove tip").at(-1));

  await waitFor(() => {
    expect(screen.getAllByTitle("Remove tip")).toHaveLength(initialRowCount);
  });
  expect(screen.queryByDisplayValue("Unique Reminder To Remove")).not.toBeInTheDocument();
});

test("does not allow deleting the last preparedness reminder", async () => {
  renderDashboard();

  await openInlineEditor();
  while (screen.getAllByTitle("Remove tip").length > 1) {
    fireEvent.click(screen.getAllByTitle("Remove tip").at(-1));
  }

  const deleteButton = screen.getByTitle("Remove tip");
  expect(deleteButton).toBeDisabled();

  fireEvent.click(deleteButton);
  expect(
    screen.getByDisplayValue("Prepare a go-bag for each household member.")
  ).toBeInTheDocument();
});

test("clears reminder validation without marking the next row invalid after removal", async () => {
  renderDashboard();

  await openInlineEditor();
  fireEvent.change(screen.getAllByPlaceholderText(/Preparedness reminder/i)[0], {
    target: { value: "" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));

  expect(
    await screen.findByText("Preparedness reminder is required.")
  ).toBeInTheDocument();

  fireEvent.click(screen.getAllByTitle("Remove tip")[0]);

  await waitFor(() => {
    expect(
      screen.queryByText("Preparedness reminder is required.")
    ).not.toBeInTheDocument();
  });
  expect(
    screen.getByDisplayValue("Keep flashlights, batteries, and water ready.")
  ).not.toHaveClass("landing-inline-input-error");
});

test("blocks save and shows inline errors for blank preparedness and update fields", async () => {
  renderDashboard();

  await openInlineEditor();
  fireEvent.change(screen.getAllByPlaceholderText(/Preparedness reminder/i)[0], {
    target: { value: "   " },
  });
  fireEvent.change(screen.getAllByPlaceholderText(/Announcement title/i)[0], {
    target: { value: "" },
  });

  fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));

  expect(
    await screen.findByText("Preparedness reminder is required.")
  ).toBeInTheDocument();
  expect(screen.getByText("Update title is required.")).toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalledWith(
    expect.stringContaining("/api/public-site"),
    expect.objectContaining({ method: "PUT" })
  );
});

test("revalidates hotline detail when the contact type changes", async () => {
  renderDashboard();

  await openInlineEditor();
  fireEvent.change(screen.getAllByLabelText(/Contact Detail/i)[0], {
    target: { value: "0999-000-0000" },
  });
  await waitFor(() => {
    expect(screen.getAllByLabelText(/Contact Detail/i)[0]).toHaveValue(
      "0999-000-0000"
    );
  });
  fireEvent.change(screen.getAllByLabelText(/Type/i)[0], {
    target: { value: "email" },
  });

  expect(
    await screen.findByText("Enter a valid email address.")
  ).toBeInTheDocument();
});

test("renders invalid styling on office email fields with bad input", async () => {
  renderDashboard();

  await openInlineEditor();
  fireEvent.change(screen.getByPlaceholderText(/Office email/i), {
    target: { value: "bad-email" },
  });

  expect(
    await screen.findByText("Enter a valid office email address.")
  ).toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Enter a valid office email address."
  );
  expect(screen.getByDisplayValue("bad-email")).toHaveClass(
    "landing-inline-input-error"
  );
});

test("clears validation state when reset is used", async () => {
  renderDashboard();

  await openInlineEditor();
  fireEvent.change(screen.getAllByPlaceholderText(/Preparedness reminder/i)[0], {
    target: { value: "" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));
  expect(
    await screen.findByText("Preparedness reminder is required.")
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /Reset/i }));

  await waitFor(() => {
    expect(
      screen.queryByText("Preparedness reminder is required.")
    ).not.toBeInTheDocument();
  });
});
