export type WebHookOptions = {
  token: string;
  baseUrl: string;
};

export const createLineNotifyClient = (webHookOptions: WebHookOptions) => {
  const { baseUrl, token } = webHookOptions;

  const sendMessage = async (message: string) => {
    const response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ message }),
    });
    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.status} ${response.statusText}`);
    }
  };

  const sendFile = async (body: { name: string; image: Blob; message?: string; user?: string }) => {
    const formData = new FormData();
    formData.append("imageFile", body.image);
    if (body.message) {
      formData.append("message", body.message);
    }

    const response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });
    if (!response.ok) {
      throw new Error(`Failed to send file: ${response.status} ${response.statusText}`);
    }
  };

  return { sendMessage, sendFile };
};
