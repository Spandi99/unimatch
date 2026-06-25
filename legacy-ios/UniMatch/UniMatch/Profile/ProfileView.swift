import SwiftUI

struct ProfileView: View {
    @Environment(AppState.self) private var appState
    @State private var showUniSheet = false

    private let bioLimit = 200

    var body: some View {
        @Bindable var state = appState
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.sectionSpacing) {
                header

                bioSection(bio: $state.myBio)

                universitiesSection

                verificationSection

                Button("Sign out") {
                    withAnimation {
                        appState.isVerified = false
                        appState.isNearbyModeOn = false
                    }
                }
                .buttonStyle(OutlinedCTAStyle(destructive: true))
                .padding(.top, 8)
            }
            .padding(.horizontal, Theme.screenPadding)
            .padding(.vertical, 12)
        }
        .navigationTitle("Profile")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showUniSheet) {
            UniversityPickerSheet(selected: $state.myUniversities)
        }
    }

    private var header: some View {
        VStack(spacing: 10) {
            AvatarCircle(initials: "MK", tint: Theme.uniTagBg, diameter: 80)
            Text("Max, 22")
                .font(.umHeading)
            TagPill(text: appState.myUniversities.first ?? "ETH Zürich",
                    bg: Theme.uniTagBg, fg: Theme.uniTagText, size: 11)
        }
        .frame(maxWidth: .infinity)
    }

    private func bioSection(bio: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Bio")
                .font(.system(size: 16, weight: .medium))
            ZStack(alignment: .topLeading) {
                if bio.wrappedValue.isEmpty {
                    Text("Write something about yourself...")
                        .font(.umBody)
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 8)
                }
                TextEditor(text: bio)
                    .font(.umBody)
                    .frame(minHeight: 90)
                    .scrollContentBackground(.hidden)
                    .onChange(of: bio.wrappedValue) { _, newValue in
                        if newValue.count > bioLimit {
                            bio.wrappedValue = String(newValue.prefix(bioLimit))
                        }
                    }
            }
            .padding(8)
            .background(Theme.surface)
            .clipShape(RoundedRectangle(cornerRadius: Theme.buttonRadius))
            Text("\(bio.wrappedValue.count) / \(bioLimit)")
                .font(.umCaption)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .trailing)
        }
    }

    private var universitiesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("My universities")
                    .font(.system(size: 16, weight: .medium))
                Spacer()
                Button {
                    showUniSheet = true
                } label: {
                    Image(systemName: "plus")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(Theme.accent)
                }
            }
            FlowLayout(spacing: 8) {
                ForEach(appState.myUniversities, id: \.self) { uni in
                    TagPill(text: uni, bg: Theme.uniTagBg, fg: Theme.uniTagText, size: 12)
                }
            }
        }
    }

    private var verificationSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Verification")
                .font(.system(size: 16, weight: .medium))
            HStack(spacing: 8) {
                Image(systemName: "checkmark.seal.fill")
                    .foregroundStyle(.green)
                Text("Verified via \(appState.verificationMethod.rawValue)")
                    .font(.umBody)
                Spacer()
            }
            .padding(12)
            .background(Theme.surface)
            .clipShape(RoundedRectangle(cornerRadius: Theme.buttonRadius))
        }
    }
}

// MARK: - University picker sheet

struct UniversityPickerSheet: View {
    @Binding var selected: [String]
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""

    private var filtered: [String] {
        query.isEmpty ? swissUniversities
            : swissUniversities.filter { $0.localizedCaseInsensitiveContains(query) }
    }

    var body: some View {
        NavigationStack {
            List(filtered, id: \.self) { uni in
                Button {
                    toggle(uni)
                } label: {
                    HStack {
                        Text(uni).font(.umBody).foregroundStyle(Color(.label))
                        Spacer()
                        if selected.contains(uni) {
                            Image(systemName: "checkmark").foregroundStyle(Theme.accent)
                        }
                    }
                }
            }
            .listStyle(.plain)
            .searchable(text: $query, prompt: "Search universities")
            .navigationTitle("Add university")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    private func toggle(_ uni: String) {
        if let i = selected.firstIndex(of: uni) {
            selected.remove(at: i)
        } else {
            selected.append(uni)
        }
    }
}

// MARK: - Simple wrapping layout for tag pills

struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, rowHeight: CGFloat = 0
        for sub in subviews {
            let size = sub.sizeThatFits(.unspecified)
            if x + size.width > maxWidth, x > 0 {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
        return CGSize(width: maxWidth, height: y + rowHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, rowHeight: CGFloat = 0
        for sub in subviews {
            let size = sub.sizeThatFits(.unspecified)
            if x + size.width > bounds.maxX, x > bounds.minX {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            sub.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}

#Preview {
    NavigationStack { ProfileView() }.environment(AppState())
}
