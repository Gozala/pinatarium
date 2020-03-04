class Effect {
  static async loadDocument(cid) {
    try {
      //ipfs.io/ipfs/QmRYPQ1HzXXNbKgAQk6MxMKjme7LjdJu2GCJ8tx6jsHjNt
      const request = await fetch(`https://ipfs.io/ipfs/${cid}/document.json`)
      const content = await request.json()
      return { content }
    } catch (error) {
      return error
    }
  }
  static async publishDocument(content, auth, cid) {
    const [head] = content.ops
    const [title] = (head.insert || "").split("\n")
    const data = new FormData()
    data.append(
      `file`,
      new File([JSON.stringify(content)], "document.json", {
        type: "application/json"
      }),
      "base/document.json"
    )

    const metadata = {
      name: title,
      keyvalues: {
        parent: cid,
        time: Date.now()
      }
    }

    data.append(
      `file`,
      new File([JSON.stringify(metadata)], "meta.json", {
        type: "application/json"
      }),
      "base/meta.json"
    )

    data.append("pinataMetadata", JSON.stringify(metadata))

    const request = await fetch(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      {
        method: "POST",
        body: data,
        headers: {
          pinata_api_key: auth.key,
          pinata_secret_api_key: auth.secret
        }
      }
    )

    const result = await request.json()
    return result
  }
}

class Main {
  constructor() {
    this.editorView = document.querySelector("#editor")
    this.bookmarkButtonView = document.querySelector("#heart-parent")
    this.publishButtonView = document.querySelector("#post-public-button")
    this.editorView = document.querySelector("#editor")

    this.editor = new Quill(this.editorView, {
      modules: {
        toolbar: {
          container: [
            [{ header: 1 }, { header: 2 }],
            ["bold", "italic", "underline", "strike"],
            ["blockquote", "code-block"],
            [{ color: [] }],
            [{ list: "bullet" }],
            ["link", "image"]
          ]
        }
      },
      theme: "bubble",
      placeholder: "Start writing.\n\nSelect the text for formatting options."
    })

    this.listen()
    this.activate()
  }
  listen() {
    this.editor.on("text-change", () => {
      this.onContentChange()
    })
    this.bookmarkButtonView.addEventListener("click", this)
    this.publishButtonView.addEventListener("click", this)
  }
  set publishDisabled(value) {
    this.publishButtonView.disabled = value
  }
  get publishDisabled() {
    return this.publishButtonView.disabled
  }

  onPublish() {
    this.publish()
  }
  onContentChange() {
    if (this.writable) {
      this.publishDisabled = false
    }
  }
  handleEvent(event) {
    switch (event.type) {
      case "click": {
        return this.onClick(event)
      }
    }
  }
  onClick(event) {
    switch (event.target) {
      case this.bookmarkButtonView:
        return this.onToggle()
      case this.publishButtonView:
        return this.onPublish()
    }
  }

  set text(text) {
    this.editor.setText(text)
  }
  get text() {
    return this.editor.getText()
  }
  get writable() {
    return this.editor.isEnabled()
  }
  get content() {
    return this.editor.getContents()
  }
  set content(content) {
    return this.editor.setContents(content)
  }
  set writable(value) {
    if (value) {
      this.editor.enable(true)
      this.editor.focus()
    } else {
      this.bookmarked = false
      this.editor.enable(false)
    }
  }
  async activate() {
    const url = new URL(document.URL)
    const params = new URLSearchParams(url.search)
    const auth = params.get("auth") || ""
    const [key, secret] = auth.split("@")
    if (key != "" && secret && secret != "") {
      this.auth = { key, secret }
      this.writable = true
    } else {
      this.writable = false
    }

    const cid = url.pathname.split("/").pop()
    if (cid !== "") {
      this.cid = cid
      this.text = `Loading ${cid} .......`
      this.writable = false
      const result = await Effect.loadDocument(cid)
      if (result instanceof Error) {
        this.text = "Ooops, something went wrong. Failing to load a document!"
        this.writable = false
      } else {
        this.content = result.content
        this.writable = !!this.auth
      }
    }
  }
  async publish() {
    try {
      this.publishDisabled = true
      const { IpfsHash: cid } = await Effect.publishDocument(
        this.editor.getContents(),
        this.auth,
        this.cid
      )

      if (cid) {
        this.bookmarked = true
        this.cid = cid
        const base = new URL(document.URL)
        const url = new URL(`/${cid}`, base)
        url.search = base.search
        url.hash = base.hash
        history.pushState({ cid }, "", url.href)
      }
    } catch (error) {
      this.publishDisabled = false
    }
  }

  set bookmarked(value) {
    this.bookmarkButtonView.className = value ? "fas fa-heart" : "far fa-heart"
  }
  get bookmarked() {
    return this.writable
  }
}

self.main = new Main()
