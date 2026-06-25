import SwiftUI

struct ChatView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    let match: Match
    let tintIndex: Int

    @State private var draft: String = ""
    @State private var showHeyUnmatch = false

    private var messages: [ChatMessage] { match.messages }

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(spacing: 10) {
                        ForEach(messages) { msg in
                            bubble(msg).id(msg.id)
                        }
                    }
                    .padding(.horizontal, Theme.screenPadding)
                    .padding(.vertical, 12)
                }
                .onChange(of: messages.count) {
                    if let last = messages.last {
                        withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
                    }
                }
            }
            HairlineDivider()
            inputBar
        }
        .navigationTitle(match.profile.name)
        .navigationBarTitleDisplayMode(.inline)
        .alert("Unmatched", isPresented: $showHeyUnmatch) {
            Button("OK") { dismiss() }
        } message: {
            Text("A first message that's just \"Hey\" isn't enough to start a conversation, so you've been unmatched.")
        }
    }

    private func bubble(_ msg: ChatMessage) -> some View {
        HStack {
            if msg.isMine { Spacer(minLength: 40) }
            Text(msg.text)
                .font(.umBody)
                .foregroundStyle(msg.isMine ? Color(.systemBackground) : Color(.label))
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(msg.isMine ? Color(.label) : Theme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 14))
            if !msg.isMine { Spacer(minLength: 40) }
        }
        .frame(maxWidth: .infinity, alignment: msg.isMine ? .trailing : .leading)
    }

    private var inputBar: some View {
        HStack(spacing: 10) {
            TextField("Message", text: $draft, axis: .vertical)
                .font(.umBody)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Theme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 18))
            Button {
                send()
            } label: {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.system(size: 30))
                    .foregroundStyle(draft.trimmingCharacters(in: .whitespaces).isEmpty ? Color(.tertiaryLabel) : Theme.accent)
            }
            .disabled(draft.trimmingCharacters(in: .whitespaces).isEmpty)
        }
        .padding(.horizontal, Theme.screenPadding)
        .padding(.vertical, 8)
    }

    private func send() {
        let text = draft.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty else { return }

        // Rule: a first message that's just "Hey" unmatches you immediately.
        if !match.userHasReplied && isLowEffortGreeting(text) {
            draft = ""
            appState.unmatch(match)
            showHeyUnmatch = true
            return
        }

        match.messages.append(ChatMessage(text: text, isMine: true))
        match.awaitingYourReplySince = nil   // you replied — 48h clock cleared
        draft = ""
    }
}

#Preview {
    NavigationStack { ChatView(match: Match(profile: mockProfiles[0]), tintIndex: 0) }
        .environment(AppState())
}
