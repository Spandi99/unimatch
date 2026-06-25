import SwiftUI

struct RootView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        if appState.isVerified {
            MainTabView()
        } else {
            AuthView()
        }
    }
}

struct MainTabView: View {
    @State private var selection = Int(ProcessInfo.processInfo.environment["UM_TAB"] ?? "0") ?? 0

    init() {
        // Purple accent for selected tab item.
        UITabBar.appearance().tintColor = UIColor(Theme.accent)
    }

    var body: some View {
        TabView(selection: $selection) {
            NavigationStack { NearbyView() }
                .tabItem {
                    Label("Nearby", systemImage: selection == 0 ? "location.circle.fill" : "location.circle")
                }
                .tag(0)

            NavigationStack { DiscoverView() }
                .tabItem {
                    Label("Discover", systemImage: selection == 1 ? "rectangle.on.rectangle.fill" : "rectangle.on.rectangle")
                }
                .tag(1)

            NavigationStack { MatchesView() }
                .tabItem {
                    Label("Matches", systemImage: selection == 2 ? "heart.fill" : "heart")
                }
                .tag(2)

            NavigationStack { ProfileView() }
                .tabItem {
                    Label("Profile", systemImage: selection == 3 ? "person.circle.fill" : "person.circle")
                }
                .tag(3)
        }
        .tint(Theme.accent)
    }
}

#Preview {
    RootView()
        .environment(AppState())
}
