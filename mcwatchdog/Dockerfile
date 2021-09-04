# version 1.0.0

FROM ubuntu:20.04

RUN apt-get update
RUN apt-get install -y curl unzip less net-tools coreutils jq gawk
RUN apt-get dist-upgrade -u -y
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
RUN unzip awscliv2.zip
RUN ./aws/install

COPY ./watchdog.sh .

ENTRYPOINT ["./watchdog.sh"]
