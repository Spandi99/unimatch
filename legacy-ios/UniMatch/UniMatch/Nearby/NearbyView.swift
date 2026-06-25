import SwiftUI

struct NearbyView: View {
    @Environment(AppState.self) private var appState
    @State private var autoPerson: NearbyPerson?   // debug deep-link only

    var body: some View {
        Group {
            if appState.isNearbyModeOn {
                nearbyOn
            } else {
                nearbyOff
            }
        }
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - State A: OFF

    private var nearbyOff: some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: "eye.slash")
                .font(.system(size: 44))
                .foregroundStyle(.secondary)
            Text("You're invisible right now")
                .font(.umBody.weight(.medium))
                .multilineTextAlignment(.center)
            Text("Turn on nearby mode to see — and be seen by — other students around you. They have to be in nearby mode too.")
                .font(.umCaption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 24)
            Spacer()
            Button("See nearby") {
                withAnimation { appState.isNearbyModeOn = true }
            }
            .buttonStyle(OutlinedCTAStyle())
        }
        .padding(.horizontal, Theme.screenPadding)
        .padding(.bottom, 24)
    }

    // MARK: - State B: ON

    private var nearbyOn: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // Active indicator pill
                HStack(spacing: 6) {
                    Circle().fill(Color.green).frame(width: 6, height: 6)
                    Text("Visible to nearby students")
                        .font(.system(size: 11, weight: .regular))
                        .foregroundStyle(.secondary)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(Theme.distancePillBg)
                .clipShape(Capsule())

                HStack(alignment: .top, spacing: 6) {
                    Image(systemName: "info.circle").font(.system(size: 12))
                    Text("Only people also in nearby mode can see you.")
                }
                .font(.umCaption)
                .foregroundStyle(.secondary)

                Text("\(mockNearby.count) people nearby".uppercased())
                    .font(.system(size: 11, weight: .regular))
                    .foregroundStyle(.secondary)
                    .padding(.top, 8)

                VStack(spacing: 0) {
                    ForEach(Array(mockNearby.enumerated()), id: \.element.id) { index, person in
                        NavigationLink {
                            NearbyProfileView(person: person, tintIndex: index)
                        } label: {
                            personRow(person, index: index)
                        }
                        .buttonStyle(.plain)
                        if index < mockNearby.count - 1 {
                            HairlineDivider()
                        }
                    }
                }

                Button("Stop being visible") {
                    withAnimation { appState.isNearbyModeOn = false }
                }
                .buttonStyle(OutlinedCTAStyle())
                .padding(.top, 16)
            }
            .padding(.horizontal, Theme.screenPadding)
            .padding(.vertical, 12)
        }
        .toolbar {
            ToolbarItem(placement: .principal) {
                VStack(spacing: 1) {
                    Text("Nearby").font(.system(size: 16, weight: .medium))
                    Text("Zürich Hauptgebäude area")
                        .font(.system(size: 11, weight: .regular))
                        .foregroundStyle(.secondary)
                }
            }
        }
        .navigationDestination(item: $autoPerson) { p in
            NearbyProfileView(person: p, tintIndex: 0)
        }
        .onAppear {
            if ProcessInfo.processInfo.environment["UM_NEARBY_PROFILE"] == "1" {
                autoPerson = mockNearby[0]
            }
        }
    }

    private func personRow(_ person: NearbyPerson, index: Int) -> some View {
        HStack(spacing: 12) {
            AvatarCircle(initials: person.initials, tint: Theme.avatarTint(index), diameter: 34, showOnlineDot: true)
            VStack(alignment: .leading, spacing: 2) {
                Text("\(person.name), \(person.age)")
                    .font(.system(size: 13, weight: .medium))
                Text("\(person.university) · \(person.degree)")
                    .font(.system(size: 11, weight: .regular))
                    .foregroundStyle(.secondary)
            }
            Spacer()
            TagPill(text: person.distanceLabel, bg: Theme.distancePillBg, fg: Theme.distancePillText, size: 11)
        }
        .padding(.vertical, 10)
        .contentShape(Rectangle())
    }
}

// MARK: - Read-only profile from a nearby row

struct NearbyProfileView: View {
    @Environment(AppState.self) private var appState
    let person: NearbyPerson
    let tintIndex: Int

    @State private var openChat: Match?

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                AvatarCircle(initials: person.initials, tint: Theme.avatarTint(tintIndex), diameter: 96)
                    .padding(.top, 24)
                Text("\(person.name), \(person.age)")
                    .font(.umHeading)
                HStack(spacing: 8) {
                    TagPill(text: person.university, bg: Theme.uniTagBg, fg: Theme.uniTagText)
                    TagPill(text: person.distanceLabel, bg: Theme.distancePillBg, fg: Theme.distancePillText)
                }
                Text(person.degree)
                    .font(.umCaption)
                    .foregroundStyle(.secondary)

                HairlineDivider().padding(.vertical, 8)

                Button("Message") {
                    openChat = appState.chat(with: person, tint: Theme.avatarTint(tintIndex))
                }
                .buttonStyle(BlackCTAStyle())

                Text("Starts a conversation — remember, a first message that's just \"Hey\" unmatches you.")
                    .font(.umCaption)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
            .padding(.horizontal, Theme.screenPadding)
        }
        .navigationTitle(person.name)
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(item: $openChat) { match in
            ChatView(match: match, tintIndex: tintIndex)
        }
    }
}

#Preview {
    NavigationStack { NearbyView() }.environment(AppState())
}
