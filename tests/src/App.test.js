import { fireEvent, render, screen, within } from "@testing-library/react";
import Dashboard from "./components/entry/Dashboard";
import DashboardShell from "./components/layout/DashboardShell";

jest.mock("react-router-dom", () => ({
  useNavigate: () => jest.fn(),
  useLocation: () => ({ pathname: "/admin" }),
}), { virtual: true });

jest.mock("./components/map/Map", () => () => (
  <div data-testid="public-evac-map">Mock public evacuation map</div>
));

jest.mock("./components/layout/Sidebar", () => () => (
  <div data-testid="admin-sidebar">Mock admin sidebar</div>
));

jest.mock("./components/layout/SidebarDRRMO", () => () => (
  <div data-testid="drrmo-sidebar">Mock DRRMO sidebar</div>
));

jest.mock("./components/layout/SidebarBarangay", () => () => (
  <div data-testid="barangay-sidebar">Mock barangay sidebar</div>
));

jest.mock("./components/common/Confirm", () => () => null);

jest.mock("./components/splashscreen/SplashScreen", () => () => null);

function createJsonResponse(data, ok = true) {
  return {
    ok,
    json: async () => data,
  };
}

beforeAll(() => {
  class MockIntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  Object.defineProperty(window, "IntersectionObserver", {
    writable: true,
    configurable: true,
    value: MockIntersectionObserver,
  });

  Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
    writable: true,
    configurable: true,
    value: jest.fn(),
  });
});

beforeEach(() => {
  global.fetch = jest.fn((url) => {
    const requestUrl = String(url);

    if (requestUrl.includes("/api/debug-session")) {
      return Promise.resolve(createJsonResponse({}, false));
    }

    if (requestUrl.includes("/api/public-site")) {
      return Promise.resolve(createJsonResponse({}, false));
    }

    if (requestUrl.includes("/evacs/public")) {
      return Promise.resolve(createJsonResponse([]));
    }

    if (requestUrl.includes("/api/barangays/bounds")) {
      return Promise.resolve(createJsonResponse([]));
    }

    if (requestUrl.includes("/incident/getIncidents")) {
      return Promise.resolve(createJsonResponse([]));
    }

    if (requestUrl.includes("open-meteo")) {
      return Promise.resolve(
        createJsonResponse({
          current: {
            temperature_2m: 28,
            apparent_temperature: 31,
            relative_humidity_2m: 74,
            wind_speed_10m: 12,
            weather_code: 2,
          },
          daily: {
            time: ["2026-08-10", "2026-08-11", "2026-08-12"],
            temperature_2m_max: [31, 30, 29],
            temperature_2m_min: [24, 24, 23],
            precipitation_probability_max: [35, 40, 45],
            weather_code: [2, 3, 61],
          },
        })
      );
    }

    return Promise.resolve(createJsonResponse({}));
  });
});

afterEach(() => {
  jest.clearAllMocks();
});

test("renders the public landing shell structure", async () => {
  render(<Dashboard />);

  expect(await screen.findByRole("banner")).toBeInTheDocument();
  expect(screen.getByRole("main")).toBeInTheDocument();
  expect(screen.getByRole("contentinfo")).toBeInTheDocument();

  const navigation = screen.getByRole("navigation", {
    name: /primary navigation/i,
  });
  expect(within(navigation).getAllByRole("button").length).toBeGreaterThan(0);

  expect(screen.getByRole("textbox")).toBeInTheDocument();
  expect(screen.getByLabelText(/public advisory/i)).toBeInTheDocument();
  expect(screen.getAllByRole("heading", { level: 2 }).length).toBeGreaterThan(0);
});

test("dashboard shell keeps the profile topbar while toggling mobile sidebar", () => {
  localStorage.setItem("username", "Alex");

  render(
    <DashboardShell variant="admin">
      <div>Admin page</div>
    </DashboardShell>
  );

  expect(screen.getByText(/signed in as/i)).toBeInTheDocument();
  expect(screen.getByText("Alex")).toBeInTheDocument();
  expect(screen.queryByText(/nadis workspace/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/admin console/i)).not.toBeInTheDocument();

  const toggle = screen.getByRole("button", { name: /open sidebar/i });
  expect(toggle).toHaveAttribute("aria-controls", "dashboard-sidebar");
  fireEvent.click(toggle);

  expect(document.querySelector(".admin-layout")).toHaveClass(
    "has-mobile-sidebar"
  );
  expect(document.querySelector(".sidebar-shell")).toHaveClass("is-open");

  const backdrop = screen.getByRole("button", {
    name: /close sidebar overlay/i,
  });
  expect(backdrop).toHaveClass("is-open");

  fireEvent.click(backdrop);

  expect(document.querySelector(".admin-layout")).not.toHaveClass(
    "has-mobile-sidebar"
  );
  expect(
    screen.queryByRole("button", { name: /close sidebar overlay/i })
  ).not.toBeInTheDocument();
});
